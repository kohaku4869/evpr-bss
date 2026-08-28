# EVPR-BSS Dynamic Routing System

Hệ thống định tuyến xe điện giao hàng tích hợp trạm đổi pin thời gian thực (**Electric Vehicle Pickup and Delivery Routing with Battery Swap Stations - EVPR-BSS**) sử dụng thuật toán **ALNS (Adaptive Large Neighborhood Search)** cho Static Planning và cơ chế **Local Patch** tức thời cho Real-time Reactive Layer, trên nền **bản đồ và mạng lưới đường bộ thật của Hà Nội** (Leaflet + OpenStreetMap + OSRM/TomTom).

---

## 🌟 Unique Selling Point (USP)

- **Real Road-Network Distance (không phải đường chim bay)**: Trước khi chạy ALNS, hệ thống gọi **OSRM Table API** một lần duy nhất để lấy toàn bộ ma trận khoảng cách/thời gian đi đường bộ thật giữa Depot – các điểm lấy/trả hàng – các trạm BSS, rồi mới đưa vào thuật toán. Toàn bộ quyết định của ALNS (thứ tự ghé, chọn trạm đổi pin, kiểm tra khả thi pin) và cả tầng Reactive Layer đều dựa trên khoảng cách đường bộ thật này — không phải đường thẳng Haversine. Bản đồ cũng vẽ polyline đường bộ thật (OSRM/TomTom) cho toàn tuyến, và xe di chuyển mô phỏng bám theo đúng các điểm toạ độ trên tuyến đường đó.
- **Static Optimization (ALNS)**: Tối ưu hóa lộ trình tổng thể thỏa mãn đồng thời các ràng buộc cứng:
  - Thứ tự lấy hàng trước giao hàng (Pickup before Delivery).
  - Giới hạn tải trọng xe $Q$.
  - Mức tiêu hao năng lượng $e(l) = \text{distance\_km} \times (\text{base\_rate} + \text{load\_factor} \times \text{load})$.
  - Đảm bảo pin không bao giờ bị âm ($y \ge 0$) bằng cách tự động chọn trạm đổi pin khả dụng khi cần.
  - Tối ưu hóa tổng chi phí $\sum c_{ij} + \sum \text{cost\_swap}$ theo khoảng cách đường bộ thật.
- **Real-time Reactive Layer (Local Patch) — Trạm đổi pin hỏng**:
  - Khi một trạm đổi pin dự kiến gặp sự cố hoặc cạn pin ($avail_f: 1 \to 0$), hệ thống **lập tức phát hiện và sửa cục bộ đoạn tuyến trong Mutable Suffix** sang trạm thay thế khả dụng gần nhất (theo khoảng cách đường bộ) có chi phí phát sinh nhỏ nhất.
  - **Giữ nguyên 100% tính toàn vẹn của Frozen Prefix** (các điểm shipper đã hoàn thành + điểm đang trên đường tới).
  - Phản hồi cực nhanh (**Latency thường < 10ms**, vượt xa yêu cầu < 1.5s) vì tận dụng ma trận khoảng cách đã được làm nóng (warm cache) sẵn từ lần tối ưu gần nhất, không cần gọi lại API bản đồ.
  - Nếu không tìm được trạm thay thế khả thi (VD: trạm duy nhất đó là điểm sạc bắt buộc và không còn dư pin cho đường vòng), hệ thống báo `route_patch_failed` rõ ràng thay vì âm thầm tạo tuyến sai.
  - Đẩy cập nhật ngay lập tức xuống client thông qua **WebSocket** thời gian thực.
- **Real-time Reactive Layer (Local Patch) — Đơn hàng mới phát sinh giữa ca**:
  - Nút demo **"➕ New Order (Live)"** giả lập một đơn hàng mới (điểm lấy + điểm trả ngẫu nhiên trong Hà Nội) xuất hiện ngay khi shipper đang chạy tuyến.
  - Đơn mới được chèn trực tiếp vào **Mutable Suffix** của tuyến đang chạy (tái sử dụng cơ chế charging-aware insertion của ALNS), **không đụng tới Frozen Prefix**.
  - Kết quả được đẩy qua cùng cơ chế WebSocket `route_patched`, hiển thị banner và vẽ lại tuyến ngay trên bản đồ.

---

## 🏗️ Cấu trúc thư mục

```
evpr-bss/
├── plan/                             # Tài liệu đặc tả bài toán & kế hoạch triển khai
│   ├── de_bai.md                     # Đặc tả bài toán Dynamic EVPR-BSS (ALNS + Reactive Layer)
│   ├── plan.md                       # Kế hoạch triển khai demo (FastAPI + SQLite + Web mini app)
│   └── plan2.md                      # Kế hoạch tích hợp bản đồ Hà Nội thật (Leaflet/OSRM/TomTom)
│
├── backend/
│   ├── app/
│   │   ├── main.py                  # Khởi tạo FastAPI app, lifespan, static UI mount
│   │   ├── config.py                # Cấu hình tham số xe, pin, ALNS, routing provider, DB
│   │   │
│   │   ├── api/                     # REST & WebSocket API endpoints
│   │   │   ├── routes_orders.py     # CRUD đơn hàng + POST /orders/inject (đơn mới reactive)
│   │   │   ├── routes_stations.py   # Lấy danh sách trạm & PATCH cập nhật trạng thái
│   │   │   ├── routes_plan.py       # POST /plan/optimize trigger ALNS
│   │   │   ├── routes_tracking.py   # Lấy tuyến active & POST complete stop
│   │   │   ├── routes_demo.py       # Reset/randomize DB & điều khiển simulator
│   │   │   └── ws_realtime.py       # WebSocket /ws/route/{shipper_id}
│   │   │
│   │   ├── core/                    # Thuật toán cốt lõi
│   │   │   ├── cost.py              # Haversine, năng lượng, chi phí đổi pin + cache ma trận khoảng cách đường bộ
│   │   │   ├── feasibility.py       # Kiểm tra ràng buộc tải trọng, pin, thứ tự pickup-delivery
│   │   │   ├── alns/                # Tầng ALNS Static Layer
│   │   │   │   ├── solution.py          # Solution representation
│   │   │   │   ├── destroy_operators.py # Random, Worst-cost, Shaw, Redundant Station Removal
│   │   │   │   ├── repair_operators.py  # Greedy, Regret-2, Charging-Aware Insertion
│   │   │   │   ├── acceptance.py        # Simulated Annealing
│   │   │   │   ├── weights.py           # Adaptive weight update & Roulette Wheel
│   │   │   │   └── alns_runner.py       # ALNS Optimization Loop
│   │   │   └── reactive/            # Tầng phản ứng thời gian thực
│   │   │       └── local_patch.py   # Frozen Prefix vs Mutable Suffix local repair (trạm hỏng)
│   │   │
│   │   ├── models/                  # SQLAlchemy ORM Models (Order, Station, Route, RouteStop, EventLog, RoutingCache)
│   │   ├── schemas/                 # Pydantic Schemas (route_schema có matrix_source, battery_capacity_kwh...)
│   │   ├── services/                # Business services
│   │   │   ├── route_service.py         # Điều phối ALNS/Reactive/DB, kể cả chèn đơn mới mid-drive
│   │   │   ├── routing_service.py       # Gọi OSRM/TomTom, cache, build ma trận khoảng cách đường bộ
│   │   │   ├── order_service.py, station_service.py
│   │   │   └── event_bus.py             # Async pub/sub + WebSocket broadcast
│   │   ├── mock/                    # SwapStationSimulator (Auto & Manual mock trạm đổi pin)
│   │   ├── db/                      # SQLite engine, init DB & Seed dữ liệu Hà Nội thật (30 trạm BSS)
│   │   └── static/                  # Web Mini App Demo (Leaflet map, HTML/CSS/JS)
│   │
│   ├── tests/                       # Bộ kiểm thử tự động (34 tests)
│   │   ├── conftest.py                  # Reset cache ma trận khoảng cách giữa các test
│   │   ├── test_cost.py
│   │   ├── test_feasibility.py
│   │   ├── test_alns_static.py
│   │   ├── test_reactive_patch.py
│   │   ├── test_routing_service.py      # OSRM table matrix, fallback Haversine, cache
│   │   ├── test_order_injection.py      # Chèn đơn mới mid-drive, bảo toàn Frozen Prefix
│   │   └── test_api_integration.py
│   │
│   ├── evrp_demo.db                 # Database SQLite
│   └── main.py                      # Entrypoint khởi động backend
│
├── pyproject.toml
├── main.py                          # Root entrypoint
└── README.md
```

---

## 🚀 Hướng dẫn cài đặt & Chạy

### 1. Cài đặt dependencies

```bash
uv sync
```

### 2. Cấu hình biến môi trường (tùy chọn)

Tạo file `.env` ở thư mục gốc nếu muốn dùng TomTom làm nhà cung cấp routing (mặc định hệ thống đã tự fallback sang **OSRM public demo server** và cuối cùng là Haversine nếu không có key/API lỗi):

```
TOMTOM_API_KEY=...
```

### 3. Chạy toàn bộ Automated Test Suite (34 tests)

```bash
uv run pytest -v
```

### 4. Khởi động Web Server & Dashboard Demo

```bash
uv run python main.py
```

Hoặc:

```bash
uv run python backend/main.py
```

Server sẽ chạy tại: **`http://localhost:8000`** (hoặc truy cập trực tiếp **`http://localhost:8000/demo`**).

---

## 🎬 Kịch bản Demo Unique Selling Point (USP)

1. Mở trình duyệt tại **`http://localhost:8000/demo`**. Bản đồ Hà Nội thật (Leaflet + OpenStreetMap) hiển thị Depot, các đơn hàng và 30 trạm BSS.
2. Nhấn nút **"⚡ Run ALNS Optimize"**:
   - Backend gọi **OSRM Table API** lấy ma trận khoảng cách đường bộ thật giữa toàn bộ điểm, rồi mới chạy ALNS lập kế hoạch tuyến ban đầu.
   - Tuyến đường được vẽ bằng **polyline đường bộ thật** trên bản đồ (Depot → Pickups → Deliveries → ghé trạm đổi pin nếu cần). Log hệ thống hiển thị nguồn ma trận (`osrm_table`) để xác nhận thuật toán đang dùng khoảng cách thật, không phải đường chim bay.
3. Nhấn **"▶️ Start Live Drive"**:
   - Xe mô phỏng di chuyển bám theo từng toạ độ trên polyline đường bộ thật của từng chặng, không nhảy thẳng theo đường chim bay giữa hai điểm dừng.
4. Tại bảng **Battery Swap Stations (BSS)**, nhấn nút của một trạm **đang nằm trong tuyến** để chuyển sang **"⚠️ DOWN"**:
   - Tầng **Reactive Layer (Local Patch)** phát hiện trạm hỏng nằm trong Mutable Suffix, chọn trạm thay thế khả thi gần nhất theo khoảng cách đường bộ, phát tín hiệu qua **WebSocket**.
   - Web Mini App hiển thị **Banner thông báo động** và vẽ lại tuyến ngay lập tức mà không làm gián đoạn shipper, không đụng tới các điểm đã hoàn thành (Frozen Prefix).
5. Trong lúc xe vẫn đang chạy, nhấn **"➕ New Order (Live)"**:
   - Một đơn hàng mới (điểm lấy + điểm trả ngẫu nhiên trong Hà Nội) được chèn ngay vào phần tuyến còn lại (Mutable Suffix), tuyến được vẽ lại và banner thông báo xuất hiện — minh hoạ khả năng phản ứng thời gian thực không chỉ với sự cố trạm pin mà cả nhu cầu phát sinh mới.
