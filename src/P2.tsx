import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import mqtt, { MqttClient } from "mqtt";
import { Toaster, toast } from "react-hot-toast";
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

/** 지도 아무 곳이나 클릭하면 패널 닫기 */
const MapClickCloser: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const map = useMap();
  useEffect(() => {
    const handler = () => onClose();
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [map, onClose]);
  return null;
};

/** 이미지 프리뷰 오버레이 */
const ImagePreview: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 10000,
      cursor: 'zoom-out'
    }}
  >
    <img
      src={src}
      alt="preview"
      style={{
        maxWidth: '92vw',
        maxHeight: '88vh',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)'
      }}
    />
  </div>
);

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
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

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
        if (topic.toLowerCase() === "notify") {
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

          // 화면 상단 토스트 알림 (간결한 경고 스타일)
          const now = new Date();
          const hhmm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          toast.custom(() => (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'rgba(60,60,60,0.85)',
                color: '#fff',
                padding: '20px 25px',
                borderRadius: 28,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <div style={{ fontSize: 32, lineHeight: 1, marginRight: 15, marginLeft: 15}}>⚠️</div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <div style={{ fontWeight: 600, fontSize: 16, marginRight: 25 }}>
                  침입 알림!
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, opacity: 0.85 }}>{hhmm}</span>
                </div>
                <div style={{ fontSize: 14, opacity: 0.95 }}>
                  "{recentArr[1] ?? '대상'}"가 침입했습니다!
                </div>
              </div>
            </div>
          ), { duration: 5000 });

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
  // 처음 진입 시에는 패널을 표시하지 않는다. (마커 클릭 시에만 표시)

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

  // Helper: 최근 시각을 "몇 분 전" 등으로 변환
  const timeAgo = (iso?: string) => {
    if (!iso) return "-";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return iso;
    const diff = Date.now() - t;
    const sec = Math.floor(diff / 1000);
    if (sec < 30) return "방금 전";
    if (sec < 60) return `${sec}초 전`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}분 전`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}시간 전`;
    const day = Math.floor(hour / 24);
    return `${day}일 전`;
  };

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <Toaster position="top-center" />
      <MapContainer center={[center.lat, center.lng]} zoom={15} style={{ height: "100%", width: "100%", zIndex: 0 }} preferCanvas>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OSM contributors'
        />
        <FitToMarkers items={items} />
        <MapClickCloser onClose={() => setCurrentId(null)} />

        {items.map((it) => (
          <Marker
            key={it.id}
            position={[it.lat, it.lng]}
            icon={alertedIds.has(it.id) ? RedIcon : DefaultIcon}
            eventHandlers={{
              click: () => {
                setCurrentId(it.id);
                setAlertedIds((prev) => {
                  if (!prev.has(it.id)) return prev;
                  const next = new Set(prev);
                  next.delete(it.id);
                  return next;
                });
              },
            }}
          />
        ))}
      </MapContainer>

      {/* Bottom info card for selected marker - 개선된 버전 */}
      {current && (
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 24,
            background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
            borderRadius: 24,
            boxShadow: "0 20px 50px rgba(0,0,0,0.15), 0 5px 20px rgba(0,0,0,0.08)",
            padding: 24,
            zIndex: 9999,
            pointerEvents: "auto",
            border: "1px solid rgba(255,255,255,0.5)",
          }}
        >
          <button
            onClick={() => setCurrentId(null)}
            aria-label="close"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 34,
              height: 34,
              borderRadius: 12,
              border: '0',
              background: 'rgba(0,0,0,0.06)',
              color: '#2d3436',
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              cursor: 'pointer'
            }}
          >
            ×
          </button>
          {/* 상단: 제목 영역 */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 12,
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "1px solid #f0f0f0"
          }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 14, 
              background: "linear-gradient(135deg, #ff4757 0%, #ff3742 100%)",
              display: "grid", 
              placeItems: "center", 
              color: "white",
              fontSize: 18,
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(255, 71, 87, 0.3)"
            }}>
              🔔
            </div>
            <div>
              <div style={{ 
                fontSize: 20, 
                fontWeight: 700, 
                color: "#2d3436",
                marginBottom: 2
              }}>
                {current.id}번 퇴치기
              </div>
              <div style={{ 
                fontSize: 14, 
                color: "#636e72",
                fontWeight: 500
              }}>
                야생동물 감지 시스템
              </div>
            </div>
          </div>

          {/* 메인 콘텐츠 영역 */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* 상단: 배터리 & 사진 영역 (1:1 비율) */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1.25fr 1fr",
              gap: 16,
              alignItems: "center"
            }}>
              {/* 배터리 & 상태 */}
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 12,
                padding: "16px 20px",
                borderRadius: 18,
                background: current.statusDot === "green" ? "linear-gradient(135deg, #00b894 0%, #00a085 100%)" : "linear-gradient(135deg, #fd79a8 0%, #e84393 100%)",
                color: "white",
                fontWeight: 600,
                fontSize: 14,
                boxShadow: current.statusDot === "green" ? "0 4px 12px rgba(0, 184, 148, 0.3)" : "0 4px 12px rgba(253, 121, 168, 0.3)",
                height: "100px"
              }}>
                <div style={{ 
                  width: 36, 
                  height: 48, 
                  borderRadius: 8, 
                  border: "2px solid rgba(255,255,255,0.3)", 
                  display: "grid", 
                  placeItems: "center", 
                  fontWeight: 700,
                  fontSize: 12,
                  background: "rgba(255,255,255,0.1)"
                }}>
                  {current.battery ? `${current.battery}%` : "--"}
                </div>
                <div style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  상태: {current.status}
                </div>
              </div>

              {/* 썸네일 */}
              <div style={{ 
                width: "100%", 
                height: "100px", 
                borderRadius: 18, 
                overflow: "hidden", 
                boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                border: "3px solid #ffffff"
              }}>
                {current.recent?.image ? (
                  <img 
                    src={current.recent.image} 
                    alt="탐지된 동물" 
                    style={{ 
                      width: "100%", 
                      height: "100%", 
                      objectFit: "cover",
                      transition: "transform 0.3s ease",
                      cursor: "zoom-in"
                    }}
                    onMouseOver={(e) => {
                      (e.target as HTMLImageElement).style.transform = "scale(1.05)";
                    }}
                    onMouseOut={(e) => {
                      (e.target as HTMLImageElement).style.transform = "scale(1)";
                    }}
                    onClick={() => setPreviewSrc(current.recent!.image)}
                  />
                ) : (
                  <div style={{ 
                    width: "100%", 
                    height: "100%", 
                    display: "grid", 
                    placeItems: "center", 
                    color: "#b2bec3", 
                    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                    fontSize: 12,
                    fontWeight: 500,
                    textAlign: "center",
                    lineHeight: 1.3
                  }}>
                    📷<br/>미리보기<br/>없음
                  </div>
                )}
              </div>
            </div>

            {/* 하단: 최근 탐지 시기 (꽉찬 너비) */}
            <div style={{
              padding: "16px 20px",
              borderRadius: 18,
              background: "linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)",
              boxShadow: "0 6px 20px rgba(253, 203, 110, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              width: "100%"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ 
                  fontSize: 24,
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                }}>⚠️</div>
                <div style={{ 
                  fontWeight: 700, 
                  color: "#e17055",
                  fontSize: 16
                }}>최근 탐지 시기</div>
              </div>
              <div style={{ 
                fontWeight: 700, 
                color: "#d63031",
                fontSize: 15,
                padding: "6px 12px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.4)"
              }}>
                {timeAgo(current.recent?.time)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상태/가이드 패널 */}
      {items.length === 0 && (
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          display: 'grid', 
          placeItems: 'center', 
          color: '#74b9ff', 
          textAlign: 'center', 
          padding: 16,
          background: 'rgba(255,255,255,0.9)',
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.6
        }}>
          <div style={{
            padding: '24px 32px',
            borderRadius: 20,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            {connected
              ? <>🔍 P1에서 추가한 장치와 일치하는<br/>데이터를 찾고 있습니다...<br/><span style={{fontSize: 14, opacity: 0.7}}>브로커 응답이 없으면 기본 데이터로 표시됩니다.</span></>
              : <>📡 브로커에 연결 중입니다...<br/><span style={{fontSize: 14, opacity: 0.7}}>잠시 후 기본 데이터로 표시될 수 있습니다.</span></>}
          </div>
        </div>
      )}
      {previewSrc && <ImagePreview src={previewSrc} onClose={() => setPreviewSrc(null)} />}
    </div>
  );
};

export default P2;