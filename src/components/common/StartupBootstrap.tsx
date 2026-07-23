import { useEffect, useRef, useState } from "react";
import { runStartupBootstrap } from "../../hooks/startup";

export function StartupBootstrap() {
  const ranRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void runStartupBootstrap().then((result) => {
      if (!result.message) return;
      setMessage(result.message);
      setTimeout(() => setMessage((current) => (current === result.message ? null : current)), 6000);
    });
  }, []);

  if (!message) return null;
  return <div className="startup-bootstrap__toast">{message}</div>;
}
