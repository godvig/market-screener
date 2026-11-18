import { isCustomId } from "../../shared/scorecardIO";
import { CORE_SCORECARD_IDS, type Scorecard } from "../../shared/scoring";

interface Props {
  cards: Scorecard[];
  /** The scorecard this list is ranked by. */
  value?: string;
  onChange: (id: string | undefined) => void;
  onEdit: () => void;
}

/** "Rank by": the list's default scorecard. The table sorts by it and keeps its column in view. */
export function LensPicker({ cards, value, onChange, onEdit }: Props) {
  const known = cards.some((c) => c.id === value);
  const core = cards.filter((c) => (CORE_SCORECARD_IDS as readonly string[]).includes(c.id));
  const presets = cards.filter((c) => !isCustomId(c.id) && !core.includes(c));
  const custom = cards.filter((c) => isCustomId(c.id));
  return (
    <span className="lens-picker">
      <label>
        <span className="lens-label">Rank by</span>
        <select value={known ? value : ""} onChange={(e) => onChange(e.target.value || undefined)} aria-label="Rank this list by scorecard">
          <option value="">No scorecard</option>
          <optgroup label="Core">
            {core.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="More scorecards">
            {presets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
          {custom.length > 0 && (
            <optgroup label="Yours">
              {custom.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <button className="lens-edit" onClick={onEdit} title="Build and tune scorecards">
        Edit…
      </button>
    </span>
  );
}
