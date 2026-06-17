export function naturalPortCompare(a: string, b: string): number {
  const re = /(\d+|\D+)/g;
  const al = a.match(re) ?? [];
  const bl = b.match(re) ?? [];
  for (let i = 0; i < Math.min(al.length, bl.length); i++) {
    const ax = al[i]!;
    const bx = bl[i]!;
    const an = parseInt(ax, 10);
    const bn = parseInt(bx, 10);
    if (!isNaN(an) && !isNaN(bn)) {
      if (an !== bn) return an - bn;
    } else if (ax !== bx) {
      return ax < bx ? -1 : 1;
    }
  }
  return al.length - bl.length;
}
