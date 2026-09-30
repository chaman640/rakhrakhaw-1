import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Shortcut `?new=1` se aaye to form seedha khule; param baad me hatta hai taaki refresh pe dobara na khule
export function useOpenFromLink() {
  const [params, setParams] = useSearchParams();
  const state = useState(() => params.get('new') === '1');
  useEffect(() => {
    if (params.get('new') !== '1') return;
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [params, setParams]);
  return state;
}
