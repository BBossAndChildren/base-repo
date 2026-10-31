interface ChipGroupProps {
  /** 그룹 이름 (스크린 리더용) */
  label: string
  options: readonly string[]
  selected: readonly string[]
  onChange: (selected: string[]) => void
  /** 고를 수 있는 최대 개수 */
  max?: number
}

/** 여러 개를 고르는 칩 (관심사 · 가치관 등) */
export function ChipGroup({ label, options, selected, onChange, max }: ChipGroupProps) {
  const reachedMax = max !== undefined && selected.length >= max

  function toggle(option: string) {
    if (selected.includes(option)) onChange(selected.filter((item) => item !== option))
    else if (!reachedMax) onChange([...selected, option])
  }

  return (
    <div className="chips" role="group" aria-label={max ? `${label} (최대 ${max}개)` : label}>
      {options.map((option) => {
        const pressed = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            className="chip"
            aria-pressed={pressed}
            disabled={!pressed && reachedMax}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
