
export default function ProjectCard({
  title = 'Untitled Project',
  description = '',
  status = 'Active',
  onClick,
}) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-')

  return (
    <article
      className="panel project-card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <span
        className={`status status-${normalizedStatus}`}
      >
        {status}
      </span>

      <h3>{title}</h3>

      <p>{description || 'No description available.'}</p>
    </article>
  )
}
