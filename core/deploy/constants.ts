export const constants = {
  a: "https://proxy-server-green-l6vsfbzhba-uw.a.run.app",
  b: "1710787199603",
  c: "NfZFVegMpdyT3P5UmAggr7T7Hb6PlcbB",
};

export function getTimestamp() {
  const x = Date.now().toString();
  const l = new Date().getMinutes();
  let j = Math.floor(l / 2) + 10;
  return x.slice(0, -2) + j.toString();
}
