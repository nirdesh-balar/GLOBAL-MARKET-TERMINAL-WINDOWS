"""Windows-only profile guard. Native Win32 handles/SDDL; no chmod or shell.

Creation supplies an owner + protected inheritable DACL atomically. Existing
objects are verified, never repaired/deleted. Ancestor handles deny delete/rename
while validation runs. Same-user/admin code can still change files after exit;
this is isolation from unrelated ordinary users, not a same-user sandbox.
"""
import ctypes as C
from ctypes import wintypes as W
import ntpath
import os
from contextlib import ExitStack, contextmanager


class ProfileSecurityError(RuntimeError):
    pass


class WindowsSecurity:
    def __init__(self):
        if os.name != "nt":
            raise ProfileSecurityError("Native Windows security required")
        self.k = C.WinDLL("kernel32", use_last_error=True)
        self.a = C.WinDLL("advapi32", use_last_error=True)
        P = C.c_void_p
        def bind(lib, name, args, result):
            f = getattr(lib, name); f.argtypes = args; f.restype = result; return f
        self.close = bind(self.k, "CloseHandle", [W.HANDLE], W.BOOL)
        self.free = bind(self.k, "LocalFree", [P], P)
        self.current = bind(self.k, "GetCurrentProcess", [], W.HANDLE)
        self.open_token = bind(self.a, "OpenProcessToken", [W.HANDLE,W.DWORD,C.POINTER(W.HANDLE)], W.BOOL)
        self.token_info = bind(self.a, "GetTokenInformation", [W.HANDLE,C.c_int,P,W.DWORD,C.POINTER(W.DWORD)], W.BOOL)
        self.sid_string = bind(self.a, "ConvertSidToStringSidW", [P,C.POINTER(W.LPWSTR)], W.BOOL)
        self.from_sddl = bind(self.a, "ConvertStringSecurityDescriptorToSecurityDescriptorW", [W.LPCWSTR,W.DWORD,C.POINTER(P),P], W.BOOL)
        self.create = bind(self.k, "CreateDirectoryW", [W.LPCWSTR,P], W.BOOL)
        self.open = bind(self.k, "CreateFileW", [W.LPCWSTR,W.DWORD,W.DWORD,P,W.DWORD,W.DWORD,W.HANDLE], W.HANDLE)
        self.attrs = bind(self.k, "GetFileAttributesW", [W.LPCWSTR], W.DWORD)
        self.handle_info = bind(self.k, "GetFileInformationByHandleEx", [W.HANDLE,C.c_int,P,W.DWORD], W.BOOL)
        self.security = bind(self.a, "GetSecurityInfo", [W.HANDLE,C.c_int,W.DWORD,C.POINTER(P),P,C.POINTER(P),P,C.POINTER(P)], W.DWORD)
        self.control = bind(self.a, "GetSecurityDescriptorControl", [P,C.POINTER(W.WORD),C.POINTER(W.DWORD)], W.BOOL)
        self.ace = bind(self.a, "GetAce", [P,W.DWORD,C.POINTER(P)], W.BOOL)
        self.volume = bind(self.k, "GetVolumeInformationW", [W.LPCWSTR,W.LPWSTR,W.DWORD,P,P,C.POINTER(W.DWORD),W.LPWSTR,W.DWORD], W.BOOL)
        self.sid = self.current_sid()

    def check(self, result):
        if not result:
            raise ProfileSecurityError("Windows profile security check failed")
        return result

    def sid_text(self, pointer):
        text = W.LPWSTR()
        self.check(self.sid_string(pointer,C.byref(text)))
        try: return text.value
        finally: self.free(C.cast(text,C.c_void_p))

    def current_sid(self):
        token = W.HANDLE(); self.check(self.open_token(self.current(),8,C.byref(token)))
        try:
            size = W.DWORD(); self.token_info(token,1,None,0,C.byref(size))
            buf = C.create_string_buffer(size.value)
            self.check(self.token_info(token,1,buf,size,C.byref(size)))
            user = self.sid_text(C.cast(buf,C.POINTER(C.c_void_p))[0])
            self.token_info(token,4,None,0,C.byref(size))
            owner_buf=C.create_string_buffer(size.value)
            self.check(self.token_info(token,4,owner_buf,size,C.byref(size)))
            self.default_owner=self.sid_text(C.cast(owner_buf,C.POINTER(C.c_void_p))[0])
            elevated=W.DWORD()
            self.check(self.token_info(token,20,C.byref(elevated),C.sizeof(elevated),C.byref(size)))
            self.elevated=bool(elevated.value)
            return user
        finally: self.close(token)

    @contextmanager
    def handle(self, path):
        # OPEN_REPARSE_POINT opens the link itself, BACKUP_SEMANTICS permits dirs.
        h = self.open(path,0x20080,3,None,3,0x02200000,None)
        if h == C.c_void_p(-1).value: raise ProfileSecurityError("Unsafe or inaccessible profile path")
        try:
            tag = (W.DWORD*2)()
            self.check(self.handle_info(h,9,tag,C.sizeof(tag)))
            if tag[0] & 0x400: raise ProfileSecurityError("Reparse point rejected")
            yield h, bool(tag[0] & 0x10)
        finally: self.close(h)

    def owner_allowed(self, owner, protected=False):
        # Managed roots always have explicit current-user ownership. An elevated
        # Windows token can make Chromium incidental children Administrators-
        # owned by default. Accept that existing privileged identity only when
        # this token proves both elevation and that exact default owner. Never
        # accept another ordinary user or broaden the two-entry DACL.
        return owner == self.sid or (not protected and self.elevated and
            self.default_owner == "S-1-5-32-544" and owner == self.default_owner)

    def verify(self, h, protected=False):
        owner=C.c_void_p(); acl=C.c_void_p(); sd=C.c_void_p()
        if self.security(h,1,5,C.byref(owner),None,C.byref(acl),None,C.byref(sd)):
            raise ProfileSecurityError("Profile ACL cannot be read")
        try:
            if not owner or not self.owner_allowed(self.sid_text(owner), protected) or not acl:
                raise ProfileSecurityError("Unexpected profile owner or DACL")
            control=W.WORD(); rev=W.DWORD(); self.check(self.control(sd,C.byref(control),C.byref(rev)))
            if protected and not control.value & 0x1000: raise ProfileSecurityError("Inherited root DACL rejected")
            count=C.cast(acl,C.POINTER(W.WORD))[2]  # ACL.AceCount at byte 4
            if count != 2: raise ProfileSecurityError("Unexpected profile permissions")
            found=set()
            for i in range(count):
                ace=C.c_void_p(); self.check(self.ace(acl,i,C.byref(ace)))
                header=C.string_at(ace,8); mask=int.from_bytes(header[4:8],"little")
                sid=self.sid_text(ace.value+8)
                if header[0] != 0 or mask != 0x1f01ff or sid not in {self.sid,"S-1-5-18"} or header[1] & ~0x13:
                    raise ProfileSecurityError("Unrelated principal or unexpected ACE rejected")
                found.add(sid)
            if found != {self.sid,"S-1-5-18"}: raise ProfileSecurityError("Incomplete profile DACL")
        finally: self.free(sd)

    def create_secure(self, path):
        class SA(C.Structure):
            _fields_=[("length",W.DWORD),("descriptor",C.c_void_p),("inherit",W.BOOL)]
        sd=C.c_void_p()
        sddl=f"O:{self.sid}G:{self.sid}D:P(A;OICI;FA;;;{self.sid})(A;OICI;FA;;;SY)"
        self.check(self.from_sddl(sddl,1,C.byref(sd),None))
        try:
            sa=SA(C.sizeof(SA),sd,False)
            if not self.create(path,C.byref(sa)) and C.get_last_error() != 183:
                raise ProfileSecurityError("Secure profile creation failed")
        finally: self.free(sd)

    def secure_tree(self, base, target):
        if not isinstance(target,str) or len(target)>1024 or '\x00' in target or ntpath.normpath(target) != target:
            raise ProfileSecurityError("Invalid profile path")
        drive, tail=ntpath.splitdrive(target)
        if not drive or drive.startswith('\\') or not tail.startswith('\\') or ':' in tail or any(p in {'.','..',''} or p.endswith((' ','.')) for p in tail[1:].split('\\')):
            raise ProfileSecurityError("Invalid profile path")
        if ntpath.commonpath([base,target]).casefold()!=base.casefold() or target.casefold()==base.casefold():
            raise ProfileSecurityError("Profile outside allowed root")
        filesystem=C.create_unicode_buffer(32);flags=W.DWORD()
        self.check(self.volume(drive+'\\',None,0,None,None,C.byref(flags),filesystem,32))
        if filesystem.value != 'NTFS' or not flags.value & 8: raise ProfileSecurityError("NTFS required")
        # Pin all ancestors without delete sharing while creating/validating.
        with ExitStack() as stack:
            current=drive+'\\'
            stack.enter_context(self.handle(current))
            for segment in tail[1:].split('\\'):
                current=ntpath.join(current,segment)
                managed=current.casefold().startswith(base.casefold()+'\\')
                if managed: self.create_secure(current)
                h,is_dir=stack.enter_context(self.handle(current))
                if not is_dir: raise ProfileSecurityError("Directory required")
                if managed: self.verify(h,protected=True)
            # Inspect incidental existing files too; never follow redirects.
            pending=[target]; count=0
            while pending:
                for entry in os.scandir(pending.pop()):
                    count+=1
                    if count>10000: raise ProfileSecurityError("Profile inspection limit exceeded")
                    with self.handle(entry.path) as (h,is_dir):
                        self.verify(h)
                        if is_dir: pending.append(entry.path)
        return {"profileReady":True,"policy":"current-user-and-system","reparsePoints":"rejected"}

    def selected_bytes(self, selected):
        """Open one explicit local CSV with pinned ancestors, no redirects/writes."""
        if not isinstance(selected,str) or len(selected)>1024 or ntpath.normpath(selected)!=selected or '\x00' in selected:
            raise ProfileSecurityError("Invalid selection")
        drive,tail=ntpath.splitdrive(selected)
        if not drive or drive.startswith('\\') or not tail.startswith('\\') or ':' in tail or ntpath.splitext(selected)[1].lower()!='.csv' or any(p in {'','.','..'} or p.endswith((' ','.')) for p in tail[1:].split('\\')):
            raise ProfileSecurityError("Invalid selection")
        drive_type=self.k.GetDriveTypeW;drive_type.argtypes=[W.LPCWSTR];drive_type.restype=W.DWORD
        if drive_type(drive+'\\') != 3:raise ProfileSecurityError("Local fixed-drive selection required")
        size_api=self.k.GetFileSizeEx;size_api.argtypes=[W.HANDLE,C.POINTER(C.c_longlong)];size_api.restype=W.BOOL
        read_api=self.k.ReadFile;read_api.argtypes=[W.HANDLE,C.c_void_p,W.DWORD,C.POINTER(W.DWORD),C.c_void_p];read_api.restype=W.BOOL
        with ExitStack() as stack:
            current=drive+'\\';stack.enter_context(self.handle(current))
            parts=tail[1:].split('\\')
            for segment in parts[:-1]:
                current=ntpath.join(current,segment)
                _,is_dir=stack.enter_context(self.handle(current))
                if not is_dir:raise ProfileSecurityError("Directory required")
            h=self.open(selected,0x20081,1,None,3,0x02200000,None)
            if h==C.c_void_p(-1).value:raise ProfileSecurityError("Selection unavailable")
            try:
                tag=(W.DWORD*2)();self.check(self.handle_info(h,9,tag,C.sizeof(tag)))
                if tag[0] & (0x400|0x10):raise ProfileSecurityError("Reparse point or directory rejected")
                size=C.c_longlong();self.check(size_api(h,C.byref(size)))
                if not 0<size.value<=65536:raise ProfileSecurityError("Invalid selection size")
                buf=C.create_string_buffer(65537);count=W.DWORD();self.check(read_api(h,buf,65537,C.byref(count),None))
                if count.value!=size.value:raise ProfileSecurityError("Selection changed")
                return buf.raw[:count.value]
            finally:self.close(h)
