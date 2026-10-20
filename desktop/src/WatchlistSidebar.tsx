import {
  Bookmark,
  ChevronDown,
  Plus,
  Upload,
  Download,
  MoreHorizontal,
  Search,
  RefreshCw,
} from "lucide-react";
import { ToolButton } from "./TerminalControls";
export function WatchlistSidebar() {
  return (
    <aside id="watchlist" className="watchlist" aria-label="Watchlist">
      <div className="watchlist-heading">
        <button
          type="button"
          disabled
          title="Watchlist management is planned"
          className="watchlist-name"
        >
          Watchlist <ChevronDown size={14} />
        </button>
        <ToolButton
          label="Create watchlist"
          planned="watchlist management is not implemented"
        >
          <Plus size={18} />
        </ToolButton>
        <ToolButton
          label="Import watchlist"
          planned="import is not implemented"
        >
          <Upload size={16} />
        </ToolButton>
        <ToolButton
          label="Export watchlist"
          planned="export is not implemented"
        >
          <Download size={16} />
        </ToolButton>
        <ToolButton
          label="Watchlist options"
          planned="watchlist management is not implemented"
        >
          <MoreHorizontal size={17} />
        </ToolButton>
      </div>
      <div className="watchlist-search">
        <RefreshCw size={15} aria-hidden="true" />
        <label>
          <Search size={13} />
          <input
            aria-label="Search this watchlist"
            placeholder="Search this watchlist"
            disabled
            title="No symbols; watchlist management is planned"
          />
        </label>
        <ToolButton
          label="Add watchlist symbol"
          planned="symbol selection requires a connected provider"
        >
          <Plus size={17} />
        </ToolButton>
      </div>
      <div className="watchlist-options">
        <select
          aria-label="Active chart selection"
          disabled
          title="Multi-chart layouts are planned"
        >
          <option>Active chart</option>
        </select>
        <select
          aria-label="Watchlist sorting"
          disabled
          title="No watchlist symbols to sort"
        >
          <option>Manual order</option>
        </select>
        <label title="Volume quotes are not connected">
          <input type="checkbox" disabled /> Vol
        </label>
      </div>
      <div className="quote-columns" aria-hidden="true">
        <span>SYMBOL · 0</span>
        <span>PRICE</span>
        <span>CHANGE %</span>
      </div>
      <div className="watchlist-rows" aria-label="Watchlist symbols">
        <div className="watchlist-empty">
          <Bookmark size={25} />
          <h2>No symbols in this session</h2>
          <p>
            Watchlist management is planned.
            <br />
            Quotes are not connected.
          </p>
          <span>NO QUOTE DATA</span>
        </div>
      </div>
      <div className="watchlist-add">
        <button
          type="button"
          disabled
          title="Adding symbols requires a permitted market provider"
        >
          <Plus size={15} /> Add symbol
        </button>
      </div>
      <div className="watchlist-foot">
        <strong>0 symbols</strong>
        <span>Session only · no saved watchlists</span>
      </div>
    </aside>
  );
}
