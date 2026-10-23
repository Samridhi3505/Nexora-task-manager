
export default function TaskTable({ tasks = [] }) {
  if (!tasks.length) {
    return (
      <p className="muted">
        No tasks found. Tasks will appear here when available.
      </p>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Assignee</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due Date</th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.title || 'Untitled Task'}</td>

              <td>
                {task.assignee ||
                  task.assignee_name ||
                  'Unassigned'}
              </td>

              <td>
                <span
                  className={`status status-${String(
                    task.status || 'To Do'
                  )
                    .toLowerCase()
                    .replace(/\s+/g, '-')}`}
                >
                  {task.status || 'To Do'}
                </span>
              </td>

              <td>{task.priority || 'Medium'}</td>

              <td>
                {task.due_date
                  ? new Date(
                      `${String(task.due_date).slice(0, 10)}T00:00:00`
                    ).toLocaleDateString()
                  : 'No due date'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
