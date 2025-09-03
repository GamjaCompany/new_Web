import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ===== Types (P1과 동일 구조) =====
export type Item = {
  id: number;
  name: string;
  status: "정상" | "고장" | "꺼짐" | string;
  statusDot: string; // "green" | "red" | "gray"
  battery: string;
  lat: number;
  lng: number;
};

// ===== Leaflet 기본 마커 아이콘 (Vite에서 경로 깨짐 방지) =====
const DefaultIcon = L.icon({
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
(L.Marker.prototype as any).options.icon = DefaultIcon;

// ===== 지도 bounds를 마커에 맞추기 =====
const FitToMarkers: React.FC<{ items: Item[] }>
= ({ items }) => {
  const map = useMap();
  useEffect(() => {
    if (!items || items.length === 0) return;
    const bounds = L.latLngBounds(items.map(i => [i.lat, i.lng] as [number, number]));
    if (items.length === 1) {
      map.setView(bounds.getCenter(), 16);
    } else {
      map.fitBounds(bounds.pad(0.2));
    }
  }, [items, map]);
  return null;
};

// ===== 작은 패널 컴포넌트 (RN 모달 대체) =====
const Panel: React.FC<{ title: string; onClose?: () => void; children: React.ReactNode }>
= ({ title, onClose, children }) => (
  <div style={{ position: "fixed", right: 20, top: 20, background: "#fff", borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,0.2)", width: 340, zIndex: 5000 }}>
    <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <strong>{title}</strong>
      {onClose && (
        <button onClick={onClose} style={{ border: 0, background: "#111", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>닫기</button>
      )}
    </div>
    <div style={{ padding: 16 }}>{children}</div>
  </div>
);

const dot = (color: string): React.CSSProperties => ({
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: 10,
  background: color,
  marginRight: 8,
});

const P2: React.FC = () => {
  const location = useLocation() as { state?: { items?: Item[] } };

  // P1에서 넘긴 items (navigate('/p2', { state: { items } }))
  const initial = useMemo(() => {
    const raw = location.state?.items ?? [];
    return raw.filter((i): i is Item => typeof i?.lat === 'number' && typeof i?.lng === 'number');
  }, [location.state?.items]);

  const [items, setItems] = useState<Item[]>(initial);
  const [currentId, setCurrentId] = useState<number | null>(items[0]?.id ?? null);
  const [panel, setPanel] = useState<"info" | "logs">("info");

  // 라우터 state로 다시 들어왔을 때 동기화
  useEffect(() => {
    if (location.state?.items) {
      const next = (location.state.items || []).filter((i: any) => typeof i?.lat === 'number' && typeof i?.lng === 'number') as Item[];
      setItems(next);
      setCurrentId(next[0]?.id ?? null);
    }
  }, [location.state?.items]);

  const center = useMemo(() => {
    if (items.length === 0) return { lat: 37.8695, lng: 127.7430 };
    const lat = items.reduce((s, i) => s + i.lat, 0) / items.length;
    const lng = items.reduce((s, i) => s + i.lng, 0) / items.length;
    return { lat, lng };
  }, [items]);

  const current = useMemo(() => items.find(i => i.id === currentId) ?? null, [items, currentId]);

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <MapContainer center={[center.lat, center.lng]} zoom={15} style={{ height: "100%", width: "100%" }} preferCanvas>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors' />
        <FitToMarkers items={items} />

        {items.map(it => (
          <Marker key={it.id} position={[it.lat, it.lng]} eventHandlers={{ click: () => { setCurrentId(it.id); setPanel('info'); } }}>
            <Popup>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={dot(it.statusDot)} />
                <strong>{it.id}번 말뚝</strong>&nbsp;— {it.status}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {current && panel === 'info' && (
        <Panel title="말뚝 정보">
          <div style={{ display: 'grid', gap: 8 }}>
            <div><b>ID:</b> {current.id}</div>
            <div><b>이름:</b> {current.name}</div>
            <div><b>배터리:</b> {current.battery}</div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={dot(current.statusDot)} />
              <b style={{ marginRight: 6 }}>상태:</b> {current.status}
            </div>
            <div><b>위치:</b> {current.lat.toFixed(6)}, {current.lng.toFixed(6)}</div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setPanel('logs')} style={{ background: '#000', color: '#fff', borderRadius: 8, padding: '8px 12px', border: 0, cursor: 'pointer' }}>감지 로그 보기</button>
            </div>
          </div>
        </Panel>
      )}

      {current && panel === 'logs' && (
        <Panel title="감지 로그" onClose={() => setPanel('info')}>
          {/* TODO: 실제 로그 데이터로 교체 */}
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>2025-01-01 12:00 — 사람 — image1.jpg</li>
            <li>2025-01-02 13:34 — 고라니 — image2.jpg</li>
          </ul>
        </Panel>
      )}

      {items.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#555', textAlign: 'center', padding: 16 }}>
          P1에서 장치를 추가한 후 "분석 보기"로 들어오면 지도가 표시돼요.
        </div>
      )}
    </div>
  );
};

export default P2;
