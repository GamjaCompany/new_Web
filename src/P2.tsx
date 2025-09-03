// import React, { useEffect, useMemo, useState } from "react";
// import { useLocation } from "react-router-dom";
// import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";

// export type Item = {
//   id: number;
//   name: string;
//   status: "정상" | "고장" | "꺼짐" | string;
//   statusDot: string;
//   battery: string;
//   lat: number;
//   lng: number;
// };

// // ✅ 하드코딩 좌표 테이블 (원하는 id/좌표로 채워 넣기)
// const DEVICE_TABLE: Record<number, { lat: number; lng: number; name?: string }> = {
//   1: { lat: 37.86952, lng: 127.7430, name: "1번 말뚝" },
//   2: { lat: 37.86970, lng: 127.7435, name: "2번 말뚝" },
//   3: { lat: 37.86930, lng: 127.7428, name: "3번 말뚝" },
// };

// const DefaultIcon = L.icon({
//   iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
//   iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
//   shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
//   iconSize: [25, 41],
//   iconAnchor: [12, 41],
//   popupAnchor: [1, -34],
//   shadowSize: [41, 41],
// });
// (L.Marker.prototype as any).options.icon = DefaultIcon;

// const isFiniteCoord = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// const FitToMarkers: React.FC<{ items: Item[] }> = ({ items }) => {
//   const map = useMap();
//   useEffect(() => {
//     const pts = items.map((i) => [i.lat, i.lng] as [number, number]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
//     if (pts.length === 0) return;
//     const bounds = L.latLngBounds(pts);
//     if (pts.length === 1) map.setView(bounds.getCenter(), 16);
//     else map.fitBounds(bounds.pad(0.2));
//   }, [items, map]);
//   return null;
// };

// const P2: React.FC = () => {
//   const location = useLocation() as { state?: { ids?: number[] } };

//   function loadIdsFromStorage(): number[] {
//     try {
//       const raw = localStorage.getItem("@piling_items");
//       if (!raw) return [];
//       const arr = JSON.parse(raw) as any[];
//       return (arr || [])
//         .map((x) => (x && typeof x.id === "number" ? x.id : NaN))
//         .filter((n) => Number.isFinite(n)) as number[];
//     } catch {
//       return [];
//     }
//   }

//   const ids = useMemo(() => location.state?.ids ?? loadIdsFromStorage(), [location.state?.ids]);

//   // ids → 좌표 테이블 매핑
//   const initialItems = useMemo(() => {
//     return ids
//       .map((id) => {
//         const c = DEVICE_TABLE[id];
//         if (!c || !isFiniteCoord(c.lat) || !isFiniteCoord(c.lng)) return null;
//         return {
//           id,
//           name: c.name ?? `${id}번 말뚝`,
//           status: "꺼짐",
//           statusDot: "gray",
//           battery: "",
//           lat: c.lat,
//           lng: c.lng,
//         } as Item;
//       })
//       .filter(Boolean) as Item[];
//   }, [ids]);

//   const [items, setItems] = useState<Item[]>(initialItems);
//   const [currentId, setCurrentId] = useState<number | null>(items[0]?.id ?? null);
//   const [panel, setPanel] = useState<"info" | "logs">("info");

//   useEffect(() => {
//     setItems(initialItems);
//     setCurrentId(initialItems[0]?.id ?? null);
//   }, [initialItems]);

//   const center = useMemo(() => {
//     const valid = items.filter((i) => isFiniteCoord(i.lat) && isFiniteCoord(i.lng));
//     if (valid.length === 0) return { lat: 37.8695, lng: 127.7430 };
//     const lat = valid.reduce((s, i) => s + i.lat, 0) / valid.length;
//     const lng = valid.reduce((s, i) => s + i.lng, 0) / valid.length;
//     return {
//       lat: Number.isFinite(lat) ? lat : 37.8695,
//       lng: Number.isFinite(lng) ? lng : 127.7430,
//     };
//   }, [items]);

//   const current = useMemo(() => items.find((i) => i.id === currentId) ?? null, [items, currentId]);

//   return (
//     <div style={{ position: "relative", height: "100vh", width: "100%" }}>
//       <MapContainer center={[center.lat, center.lng]} zoom={15} style={{ height: "100%", width: "100%" }} preferCanvas>
//         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM contributors' />
//         <FitToMarkers items={items} />

//         {items
//           .filter((it) => Number.isFinite(it.lat) && Number.isFinite(it.lng))
//           .map((it) => (
//             <Marker key={it.id} position={[it.lat, it.lng]} eventHandlers={{ click: () => { setCurrentId(it.id); setPanel("info"); } }}>
//               <Popup>
//                 <div style={{ display: "flex", alignItems: "center" }}>
//                   <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 10, background: it.statusDot, marginRight: 8 }} />
//                   <strong>{it.id}번 말뚝</strong>&nbsp;— {it.status}
//                 </div>
//               </Popup>
//             </Marker>
//           ))}
//       </MapContainer>

//       {current && panel === "info" && (
//         <div style={{ position: "fixed", right: 20, top: 20, background: "#fff", borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,0.2)", width: 340, zIndex: 5000 }}>
//           <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//             <strong>말뚝 정보</strong>
//             <button onClick={() => setPanel("logs")} style={{ border: 0, background: "#111", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
//               감지 로그
//             </button>
//           </div>
//           <div style={{ padding: 16 }}>
//             <div style={{ display: "grid", gap: 8 }}>
//               <div><b>ID:</b> {current.id}</div>
//               <div><b>이름:</b> {current.name}</div>
//               <div><b>배터리:</b> {current.battery || "-"}</div>
//               <div style={{ display: "flex", alignItems: "center" }}>
//                 <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 10, background: current.statusDot, marginRight: 8 }} />
//                 <b style={{ marginRight: 6 }}>상태:</b> {current.status}
//               </div>
//               <div><b>위치:</b> {current.lat.toFixed(6)}, {current.lng.toFixed(6)}</div>
//             </div>
//           </div>
//         </div>
//       )}

//       {current && panel === "logs" && (
//         <div style={{ position: "fixed", right: 20, top: 20, background: "#fff", borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,0.2)", width: 340, zIndex: 5000 }}>
//           <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//             <strong>감지 로그</strong>
//             <button onClick={() => setPanel("info")} style={{ border: 0, background: "#111", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
//               정보
//             </button>
//           </div>
//           <div style={{ padding: 16 }}>
//             <ul style={{ paddingLeft: 18, margin: 0 }}>
//               <li>2025-01-01 12:00 — 사람 — image1.jpg</li>
//               <li>2025-01-02 13:34 — 고라니 — image2.jpg</li>
//             </ul>
//           </div>
//         </div>
//       )}

//       {items.length === 0 && (
//         <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#555", textAlign: "center", padding: 16 }}>
//           P1에서 말뚝을 추가한 뒤 “분석 보기”로 들어오면 지도가 표시됩니다.
//         </div>
//       )}
//     </div>
//   );
// };

// export default P2;

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import mqtt, { MqttClient } from "mqtt";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ===== Types =====
type RawDevice = {
  battery: string;
  temp: string;
  humi: string;
  status: "GOOD" | "BAD" | "OFF" | string;
  lat: string;   // 브로커에서 문자열로 옴
  lng: string;   // 브로커에서 문자열로 옴
  recent_obj?: [string, string, string]; // [time, target, imageUrl]
};
type RawDeviceMap = Record<string, RawDevice>;

// --- Fallback dataset when MQTT can't open (dev/testing) ---
const FALLBACK_RAW: RawDeviceMap = {
  "1": {"battery":"40","temp":"24.6","humi":"70","status":"GOOD","lat":"37.869422","lng":"127.743069","recent_obj":["2025-05-01T23:21:52","hog","https://m.health.chosun.com/site/data/img_dir/2022/05/24/2022052402229_0.jpg"]},
  "2": {"battery":"40","temp":"24.6","humi":"70","status":"BAD","lat":"37.869436","lng":"127.742939","recent_obj":["2025-05-01T23:21:52","hog","https://thumb.mt.co.kr/06/2024/02/2024021621113371189_1.jpg/dims/optimize/"]},
  "3": {"battery":"40","temp":"24.6","humi":"70","status":"OFF","lat":"37.869562","lng":"127.742999","recent_obj":["2025-05-01T23:21:52","hog","https://newsimg.hankookilbo.com/2020/04/24/202004241244319174_1.jpg"]},
  "4": {"battery":"20","temp":"24.6","humi":"70","status":"BAD","lat":"37.869501","lng":"127.743001","recent_obj":["2025-05-01T23:21:52","hog","https://newsimg.hankookilbo.com/2020/04/24/202004241244319174_1.jpg"]},
};

export type Item = {
  id: number;
  name: string;
  status: "정상" | "고장" | "꺼짐" | string;
  statusDot: string; // "green" | "red" | "gray"
  battery: string;
  lat: number;
  lng: number;
  recent?: { time: string; target: string; image: string } | null;
};

// ===== 상태 매핑 =====
function mapStatus(s: RawDevice["status"]) {
  switch (s) {
    case "GOOD":
      return { status: "정상" as const, dot: "green" };
    case "BAD":
      return { status: "고장" as const, dot: "red" };
    case "OFF":
    default:
      return { status: "꺼짐" as const, dot: "gray" };
  }
}

// ===== Leaflet 기본 마커 아이콘 (Vite 경로 이슈 방지) =====
const DefaultIcon = L.icon({
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
// DefaultIcon 아래에 추가
const RedIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
(L.Marker.prototype as any).options.icon = DefaultIcon;

const isFiniteCoord = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// ===== 지도 bounds를 마커에 맞추기 =====
const FitToMarkers: React.FC<{ items: Item[] }> = ({ items }) => {
  const map = useMap();
  useEffect(() => {
    const pts = items
      .map(i => [i.lat, i.lng] as [number, number])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    if (pts.length === 0) return;
    const bounds = L.latLngBounds(pts);
    if (pts.length === 1) map.setView(bounds.getCenter(), 16);
    else map.fitBounds(bounds.pad(0.2));
  }, [items, map]);
  return null;
};

// ===== 유틸: ids 복구 (라우터 state 없을 때 대비) =====
function loadIdsFromStorage(): number[] {
  try {
    const raw = localStorage.getItem("@piling_items");
    if (!raw) return [];
    const arr = JSON.parse(raw) as any[];
    return (arr || [])
      .map((x) => (x && typeof x.id === "number" ? x.id : NaN))
      .filter((n) => Number.isFinite(n)) as number[];
  } catch {
    return [];
  }
}

// ===== 유틸: HH:MM:SS 생성 =====
function nowHHMMSS() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// ===== 메인 =====
const P2: React.FC = () => {
  const location = useLocation() as { state?: { ids?: number[] } };

  // 1) P1에서 넘어온 ids (or 복구)
  const ids = useMemo(() => location.state?.ids ?? loadIdsFromStorage(), [location.state?.ids]);
  const idSet = useMemo(() => new Set(ids.map(Number)), [ids]);

  // 2) 브로커에서 받은 전체 장치표 원본
  const [rawMap, setRawMap] = useState<RawDeviceMap>({});
  const [alertedIds, setAlertedIds] = useState<Set<number>>(new Set());
  const [connected, setConnected] = useState(false);

  // 3) MQTT 연결 & 요청/응답
  const clientRef = useRef<MqttClient | null>(null);
  useEffect(() => {
    // ids가 없으면 MQTT 연결 시도도 의미가 없음
    if (!ids || ids.length === 0) {
      setRawMap({});
      return;
    }

    let didConnect = false;
    const url = "wss://1c15066522914e618d37acbb80809524.s1.eu.hivemq.cloud:8884/mqtt";

    const client = mqtt.connect(url, {
      protocol: "wss",
      clientId: `web-${crypto.randomUUID()}`,
      username: "tester",
      password: "Test1234",
      keepalive: 60,
      reconnectPeriod: 2000,
      connectTimeout: 10000,
      // path는 URL에 포함되어 있으므로 생략 가능
    });

    clientRef.current = client;

    // 3초 안에 연결 안되면 개발용 FALLBACK로 지도 표시
    const fallbackTimer = window.setTimeout(() => {
      if (!didConnect) {
        console.warn("MQTT connect timeout → using FALLBACK_RAW");
        setConnected(false);
        setRawMap(FALLBACK_RAW);
      }
    }, 3000);

    client.on("connect", () => {
      didConnect = true;
      window.clearTimeout(fallbackTimer);
      setConnected(true);

      client.subscribe(["Response/#", "Notify"], (err) => err && console.error("subscribe error", err));

      const mac = "AA:BB:CC:11:22:33"; // 예시 MAC
      const payload = { id: mac, timestamp: nowHHMMSS() };
      client.publish("GET/device", JSON.stringify(payload));
    });

    client.on("message", (topic, payload) => {
      try {
        const text = String(payload);
    
        // 1) 전체 장치표
        if (topic.startsWith("Response/")) {
          const parsed = JSON.parse(text) as RawDeviceMap;
          if (parsed && typeof parsed === "object") setRawMap(parsed);
          return;
        }
    
        // 2) 실시간 알림
        if (topic === "Notify") {
          const msg = JSON.parse(text) as any;
          if (!msg || msg.cmd !== "alert") return;
    
          const numId = Number(msg.id ?? msg.idx);
          if (!Number.isFinite(numId)) return;
    
          const recentArr =
            Array.isArray(msg.recent_obj) && msg.recent_obj.length >= 3
              ? [
                  String(msg.recent_obj[0]),
                  String(msg.recent_obj[1]),
                  String(msg.recent_obj[2]),
                ] as [string, string, string]
              : undefined;
    
          if (!recentArr) return;
    
          // rawMap 내 해당 id만 recent_obj 교체
          setRawMap((prev) => {
            const key = String(numId);
            const cur = prev[key];
            if (!cur) return prev; // 아직 Response 데이터가 없으면 스킵
            return { ...prev, [key]: { ...cur, recent_obj: recentArr } };
          });
    
          // 마커 빨간색 표시
          setAlertedIds((prev) => {
            const next = new Set(prev);
            next.add(numId);
            return next;
          });
    
          return;
        }
      } catch (e) {
        console.error("MQTT message parse error:", e);
      }
    });

    client.on("error", (e) => {
      console.error("MQTT Error", e);
    });

    client.on("close", () => {
      console.log("MQTT Closed");
      // 연결이 전혀 안된 상태에서 바로 닫히면 FALLBACK 사용 (이미 세팅됐으면 덮어쓰지 않음)
      if (!didConnect && Object.keys(rawMap).length === 0) {
        setRawMap((prev) => (Object.keys(prev).length ? prev : FALLBACK_RAW));
      }
      setConnected(false);
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      client.end(true);
      clientRef.current = null;
    };
  }, [ids]);

  // 4) rawMap × idSet 교집합 → 지도 items
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const key of Object.keys(rawMap)) {
      const numId = Number(key);
      if (!idSet.has(numId)) continue; // P1에 없는 장치면 스킵

      const d = rawMap[key];
      const lat = Number(d.lat);
      const lng = Number(d.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const { status, dot } = mapStatus(d.status);
      const recent = Array.isArray(d.recent_obj) && d.recent_obj.length >= 3
        ? { time: String(d.recent_obj[0]), target: String(d.recent_obj[1]), image: String(d.recent_obj[2]) }
        : null;

      out.push({
        id: numId,
        name: `${numId}번 말뚝`,
        status,
        statusDot: dot,
        battery: String(d.battery ?? ""),
        lat,
        lng,
        recent,
      });
    }
    // id 순 정렬
    out.sort((a, b) => a.id - b.id);
    return out;
  }, [rawMap, idSet]);

  const [currentId, setCurrentId] = useState<number | null>(null);
  useEffect(() => {
    setCurrentId(items[0]?.id ?? null);
  }, [items]);

  const center = useMemo(() => {
    const valid = items.filter((i) => isFiniteCoord(i.lat) && isFiniteCoord(i.lng));
    if (valid.length === 0) return { lat: 37.8695, lng: 127.7430 };
    const lat = valid.reduce((s, i) => s + i.lat, 0) / valid.length;
    const lng = valid.reduce((s, i) => s + i.lng, 0) / valid.length;
    return {
      lat: Number.isFinite(lat) ? lat : 37.8695,
      lng: Number.isFinite(lng) ? lng : 127.7430,
    };
  }, [items]);

  const current = useMemo(() => items.find((i) => i.id === currentId) ?? null, [items, currentId]);

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <MapContainer center={[center.lat, center.lng]} zoom={15} style={{ height: "100%", width: "100%" }} preferCanvas>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OSM contributors'
        />
        <FitToMarkers items={items} />

        {items.map((it) => (
          <Marker
            key={it.id}
            position={[it.lat, it.lng]}
            icon={alertedIds.has(it.id) ? RedIcon : DefaultIcon}
            eventHandlers={{
              click: () => {
                setCurrentId(it.id);
                // 클릭 시 알림 상태 해제 → 빨간 마커를 파란 마커로 복귀
                setAlertedIds((prev) => {
                  if (!prev.has(it.id)) return prev;
                  const next = new Set(prev);
                  next.delete(it.id);
                  return next;
                });
              },
            }}
          >
            <Popup>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 10, background: it.statusDot, marginRight: 8 }} />
                  <strong>{it.id}번 말뚝</strong>&nbsp;— {it.status}
                </div>
                <div><b>배터리:</b> {it.battery || "-"}</div>
                {it.recent && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <img src={it.recent.image} alt="preview" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
                    <div style={{ fontSize: 12 }}>
                      <div>{it.recent.time}</div>
                      <div>{it.recent.target}</div>
                    </div>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* 상태/가이드 패널 */}
      {items.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#555', textAlign: 'center', padding: 16 }}>
          {connected
            ? <>P1에서 추가한 id와 일치하는 장치가 없어요.<br/>브로커 응답이 없으면 기본 데이터로 표시합니다.</>
            : <>브로커에 연결 중이거나, 연결이 차단됐어요.<br/>잠시 후 기본 데이터로 표시될 수 있어요.</>}
        </div>
      )}
    </div>
  );
};

export default P2;