import { Link } from "react-router-dom";

export function NotFound({ message = "We couldn't find that page." }: { message?: string }) {
  return (
    <div className="page narrow center">
      <div className="card empty-state">
        <h1>Nothing here</h1>
        <p className="muted">{message}</p>
        <Link to="/" className="btn btn-primary">
          Create an event
        </Link>
      </div>
    </div>
  );
}
