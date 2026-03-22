import { useEffect, useState } from "react";

const REFRESH_MS = 30 * 1000;

export function useMinuteNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, REFRESH_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return now;
}
