// The book Joe is reading, from his Goodreads shelf (data/shelf.json, refreshed daily).
// It lies closed with a lift ticket for a bookmark at his page. The page block is as thick
// as the book is long, and it opens to that page: the read pages swing over to the left.

import * as THREE from "three";
import { TOP, tween, lerp, canvasTexture, rng, mesh, averageColor, roundRect } from "./kit.js";

const img = (src) => new Promise((ok) => {
  const i = new Image();
  i.onload = () => ok(i); i.onerror = () => ok(null);
  i.src = src;
});

// The shelf, the current book's cover, and spine colours for two favourites.
export async function loadShelf() {
  try {
    const res = await fetch("data/shelf.json", { cache: "no-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.reading?.[0] || null;
    const favs = (data.favorites || []).slice(0, 2);
    const [cover, ...favImgs] = await Promise.all([current?.cover ? img(current.cover) : null, ...favs.map((b) => (b.cover ? img(b.cover) : null))]);
    const spines = favs.map((b, i) => ({ title: b.title, author: b.author || "", color: favImgs[i] ? averageColor(favImgs[i]) : new THREE.Color("#3d4a40") }));
    return { data, current, cover, spines };
  } catch {
    return null;
  }
}

// A page of a novel, seen from the chair: a running head, greyed lines of text and the folio.
function pageTexture(head, folio, seed, flip) {
  return canvasTexture(640, 1000, (g, w, h) => {
    if (flip) { g.translate(w, h); g.rotate(Math.PI); }
    g.fillStyle = "#efe6d3"; g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(120, 90, 50, ${r() * 0.04})`; g.fillRect(r() * w, r() * h, 2, 2); }
    // Toward the gutter the page darkens where it curves into the spine.
    const odd = folio % 2 === 1;
    const gut = g.createLinearGradient(odd ? 0 : w, 0, odd ? 90 : w - 90, 0);
    gut.addColorStop(0, "rgba(60, 40, 20, 0.28)"); gut.addColorStop(1, "rgba(60, 40, 20, 0)");
    g.fillStyle = gut; g.fillRect(0, 0, w, h);
    g.fillStyle = "#4a443c";
    g.font = "italic 400 24px 'Source Serif 4', serif"; g.textAlign = "center";
    g.fillText(head, w / 2, 70);
    g.textAlign = odd ? "right" : "left";
    g.font = "400 24px 'Source Serif 4', serif";
    g.fillText(String(folio), odd ? w - 64 : 64, 70);
    const left = 64, right = w - 64, line = 31;
    let y = 120;
    while (y < h - 70) {
      const para = 3 + Math.floor(r() * 9);
      for (let l = 0; l < para && y < h - 70; l++, y += line) {
        let x = left + (l === 0 ? 34 : 0);
        const end = l === para - 1 ? left + (right - left) * (0.3 + r() * 0.6) : right;
        g.fillStyle = "rgba(48, 44, 40, 0.42)";
        while (x < end - 10) {
          const word = Math.min(end - x, 14 + r() * 62);
          g.fillRect(x, y - 13, word, 13);
          x += word + 9;
        }
      }
      y += 4;
    }
  });
}

const edgeTexture = () => canvasTexture(64, 256, (g, w, h) => {
  g.fillStyle = "#e9dfc9"; g.fillRect(0, 0, w, h);
  const r = rng(91);
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(110, 85, 50, ${0.05 + r() * 0.12})`; g.fillRect(0, y, w, 1); }
}, { repeat: [1, 4] });

// A lift ticket, used as a bookmark.
const ticketTexture = () => canvasTexture(256, 600, (g, w, h) => {
  g.fillStyle = "#f6f4ef"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#e4572e"; g.fillRect(0, 0, w, 150);
  // A mountain mark.
  g.fillStyle = "#f6f4ef";
  g.beginPath(); g.moveTo(40, 120); g.lineTo(108, 36); g.lineTo(140, 74); g.lineTo(162, 52); g.lineTo(216, 120); g.closePath(); g.fill();
  g.fillStyle = "#e4572e";
  g.beginPath(); g.moveTo(96, 51); g.lineTo(108, 36); g.lineTo(122, 53); g.lineTo(112, 49); g.closePath(); g.fill();
  g.fillStyle = "#1d1f22"; g.textAlign = "center";
  g.font = "700 46px 'Barlow Condensed', sans-serif"; g.fillText("LIFT TICKET", w / 2, 210);
  g.font = "600 30px 'Barlow Condensed', sans-serif"; g.fillText("ADULT  ·  ALL DAY", w / 2, 252);
  g.fillStyle = "#e4572e"; roundRect(g, 46, 290, w - 92, 74, 10); g.fill();
  g.fillStyle = "#f6f4ef"; g.font = "700 44px 'Barlow Condensed', sans-serif"; g.fillText("VALID TODAY", w / 2, 343);
  const r = rng(7);
  g.fillStyle = "#1d1f22";
  for (let x = 40; x < w - 40; x += 3 + Math.floor(r() * 4)) g.fillRect(x, 400, 1 + Math.floor(r() * 3), 90);
  g.font = "500 22px 'Instrument Sans', sans-serif"; g.fillText("NON-TRANSFERABLE", w / 2, 530);
});

export function buildBook(scene, shelf, { x, z, ry }) {
  const book = shelf?.current;
  if (!book || !shelf.cover) return null;

  const aspect = shelf.cover.naturalWidth / shelf.cover.naturalHeight || 0.64;
  const H = 0.205, W = H * aspect;          // a paperback, cover-up, the top edge away from the chair
  const pages = book.pages || 400;
  const read = book.percent ?? (book.page && book.pages ? book.page / book.pages : 0.3);
  const page = book.page || Math.round(read * pages);
  const leaves = 0.0001;                     // one leaf, two pages, of paperback stock
  const T = (pages / 2) * leaves, C = 0.0011; // the page block and each cover
  const tRead = Math.max(0.0012, T * read), tLeft = Math.max(0.0012, T - tRead);

  const root = new THREE.Group();
  root.position.set(x, TOP, z); root.rotation.y = ry;
  scene.add(root);

  const coverTex = new THREE.Texture(shelf.cover);
  coverTex.colorSpace = THREE.SRGBColorSpace; coverTex.anisotropy = 8; coverTex.needsUpdate = true;
  const tone = averageColor(shelf.cover);
  const board = new THREE.MeshPhysicalMaterial({ color: tone, roughness: 0.5, clearcoat: 0.3 });
  const coverTop = new THREE.MeshPhysicalMaterial({ map: coverTex, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const edges = new THREE.MeshStandardMaterial({ map: edgeTexture(), roughness: 0.95 });
  const paper = (folio, flip) => new THREE.MeshStandardMaterial({ map: pageTexture(book.title, folio, folio, flip), roughness: 0.92 });
  // Box faces: +x, −x, +y, −y, +z, −z.
  const back = mesh(new THREE.BoxGeometry(W, C, H), board);
  back.position.y = C / 2;
  const spine = mesh(new THREE.BoxGeometry(C, T + C * 2, H), board);
  spine.position.set(-W / 2 + C / 2, (T + C * 2) / 2, 0);
  const unread = mesh(new THREE.BoxGeometry(W - 0.004, tLeft, H - 0.005), [edges, edges, paper(page % 2 ? page : page + 1, false), edges, edges, edges]);
  unread.position.set(0.001, C + tLeft / 2, 0);
  root.add(back, spine, unread);

  // The read pages and the front cover turn together on the spine.
  const hinge = new THREE.Group();
  hinge.position.set(-W / 2 + C, C + tLeft, 0);
  root.add(hinge);
  const done = mesh(new THREE.BoxGeometry(W - 0.004, tRead, H - 0.005), [edges, edges, edges, paper(page % 2 ? page - 1 : page, true), edges, edges]);
  done.position.set((W - 0.004) / 2, tRead / 2, 0);
  const front = mesh(new THREE.BoxGeometry(W, C, H), [board, board, coverTop, board, board, board]);
  front.position.set(W / 2 - C, tRead + C / 2, 0);
  hinge.add(done, front);

  // The bookmark sticks out of the top edge at the page.
  const ticket = mesh(new THREE.BoxGeometry(0.03, 0.0003, 0.07), [edges, edges, new THREE.MeshStandardMaterial({ map: ticketTexture(), roughness: 0.6 }), edges, edges, edges]);
  ticket.position.set(W * 0.12, C + tLeft + 0.0002, -H / 2 + 0.035 - 0.028);
  ticket.rotation.y = 0.06;
  root.add(ticket);

  // Open: turn past flat so the read side rests on the desk, sloping up to the gutter.
  const reach = W - C, t = tRead + C, rest = C + tLeft;
  const openAngle = Math.PI + Math.asin(Math.min(1, rest / Math.hypot(reach, t))) - Math.atan2(t, reach);
  let open = false;
  const set = (k) => {
    hinge.rotation.z = k * openAngle;
    hinge.position.y = C + tLeft + Math.sin(k * Math.PI) * 0.01;
    ticket.rotation.z = -k * 0.08;
  };

  const progress = book.page && book.pages ? `page ${book.page} of ${book.pages}` : `${Math.round(read * 100)}% in`;
  return {
    root,
    label: book.title,
    sub: `${book.author}. I’m on ${progress}`,
    async act() {
      if (!open) { open = true; await tween(1100, (k) => set(k), "inOut"); }
      return "reading";
    },
    close() { if (open) { open = false; tween(800, (k) => set(lerp(1, 0, k)), "inOut"); } },
  };
}
