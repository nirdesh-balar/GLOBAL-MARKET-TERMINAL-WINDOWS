"""Collected only by explicit native Windows security CI; never POSIX proof."""
import ctypes as C
from ctypes import wintypes as W
import json
import struct
import pytest
from profile_security import WindowsSecurity, ProfileSecurityError


def test_native_owner_protected_acl_and_repeat_open(tmp_path):
    g=WindowsSecurity(); target=str(tmp_path / 'private' / 'Desktop')
    assert g.secure_tree(str(tmp_path),target)['profileReady'] is True
    with g.handle(target) as (h,is_dir):
        assert is_dir
        g.verify(h,protected=True)
    assert g.secure_tree(str(tmp_path),target)['policy']=='current-user-and-system'
    assert g.sid.startswith('S-1-5-')
    child=__import__('pathlib').Path(target)/'incidental-runtime-file'
    child.write_text('runtime-only-test')
    with g.handle(str(child)) as (h,is_dir):
        assert not is_dir
        g.verify(h)
    assert g.secure_tree(str(tmp_path),target)['profileReady'] is True


def test_existing_unexpected_permissions_rejected_without_repair(tmp_path):
    g=WindowsSecurity(); target=tmp_path / 'unexpected'; target.mkdir()
    marker=target/'untouched.txt';marker.write_text('preserve')
    # Native current-user + Everyone grant deliberately violates the guard policy.
    sd=C.c_void_p();g.check(g.from_sddl(f'O:{g.sid}D:P(A;OICI;FA;;;{g.sid})(A;OICI;GR;;;WD)',1,C.byref(sd),None))
    setter=g.a.SetFileSecurityW;setter.argtypes=[W.LPCWSTR,W.DWORD,C.c_void_p];setter.restype=W.BOOL
    try:g.check(setter(str(target),4|0x80000000,sd))
    finally:g.free(sd)
    with pytest.raises(ProfileSecurityError):g.secure_tree(str(tmp_path),str(target))
    assert marker.read_text()=='preserve'


def test_traversal_ads_unc_and_existing_file_rejected(tmp_path):
    g=WindowsSecurity();target=tmp_path/'file';target.write_text('retain')
    for value in [str(target),str(tmp_path)+'\\..\\outside',str(tmp_path)+'\\bad:stream','relative',r'\\server\share\private',str(tmp_path)+'\\bad.']:
        with pytest.raises((ProfileSecurityError,ValueError)):g.secure_tree(str(tmp_path),value)
    assert target.read_text()=='retain'


def junction(g, link, target):
    link.mkdir()
    substitute='\\??\\'+str(target)
    path_buffer=(substitute+'\0'+str(target)+'\0').encode('utf-16le')
    sub_len=len(substitute.encode('utf-16le'));print_len=len(str(target).encode('utf-16le'))
    buffer=struct.pack('<IHHHHHH',0xA0000003,len(path_buffer)+8,0,0,sub_len,sub_len+2,print_len)+path_buffer
    h=g.open(str(link),0x40000000,0,None,3,0x02200000,None)
    assert h!=C.c_void_p(-1).value
    ioctl=g.k.DeviceIoControl;ioctl.argtypes=[W.HANDLE,W.DWORD,C.c_void_p,W.DWORD,C.c_void_p,W.DWORD,C.POINTER(W.DWORD),C.c_void_p];ioctl.restype=W.BOOL
    try:
        n=W.DWORD();g.check(ioctl(h,0x900A4,buffer,len(buffer),None,0,C.byref(n),None))
    finally:g.close(h)


def test_native_junction_reparse_rejected_and_target_preserved(tmp_path):
    g=WindowsSecurity();outside=tmp_path/'outside';outside.mkdir();marker=outside/'marker';marker.write_text('untouched')
    link=tmp_path/'junction';junction(g,link,outside)
    with pytest.raises(ProfileSecurityError):g.secure_tree(str(tmp_path),str(link/'Desktop'))
    assert not (outside/'Desktop').exists()
    assert marker.read_text()=='untouched'


def test_reparse_inside_existing_secure_profile_rejected(tmp_path):
    g=WindowsSecurity();target=tmp_path/'private';g.secure_tree(str(tmp_path),str(target))
    outside=tmp_path/'outside';outside.mkdir();junction(g,target/'redirect',outside)
    with pytest.raises(ProfileSecurityError):g.secure_tree(str(tmp_path),str(target))
    assert list(outside.iterdir())==[]


def test_selected_file_native_pinned_read_no_reparse_or_directory(tmp_path):
    g=WindowsSecurity();file=tmp_path/'selected.csv';file.write_bytes(b'first,second\nalpha,beta\n')
    assert g.selected_bytes(str(file))==file.read_bytes()
    directory=tmp_path/'directory.csv';directory.mkdir()
    with pytest.raises(ProfileSecurityError):g.selected_bytes(str(directory))
    outer=tmp_path/'redirect';junction(g,outer,tmp_path)
    with pytest.raises(ProfileSecurityError):g.selected_bytes(str(outer/'selected.csv'))
    large=tmp_path/'large.csv';large.write_bytes(b'x'*65537)
    with pytest.raises(ProfileSecurityError):g.selected_bytes(str(large))
    assert file.read_bytes()==b'first,second\nalpha,beta\n'
