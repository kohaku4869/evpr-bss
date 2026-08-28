# EVPR-BSS Dynamic Routing System

Hệ thống định tuyến xe điện giao hàng tích hợp trạm đổi pin thời gian thực (**Electric Vehicle Pickup and Delivery Routing with Battery Swap Stations - EVPR-BSS**) sử dụng thuật toán **ALNS (Adaptive Large Neighborhood Search)** cho Static Planning và cơ chế **Local Patch** tức thời cho Real-time Reactive Layer.

---

## 🌟 Unique Selling Point (USP)

- **Static Optimization (ALNS)**: Tối ưu hóa lộ trình tổng thể thỏa mãn đồng thời các ràng buộc cứng:
  - Thứ tự lấy hàng trước giao hàng (Pickup before Delivery).
  - Giới hạn tải trọng xe $Q$.
  - Mức tiêu hao năng lượng $e(l) = \text{distance} \times (\text{base\_rate} + \text{load\_factor} \times \text{load})$.
  - Đảm bảo pin không bao giờ bị âm ($y \ge 0$) bằng cách tự động chọn trạm đổi pin khả dụng khi cần.
  - Tối ưu hóa tổng chi phí $\sum c_{ij} + \sum \text{cost\_swap}$.
- **Real-time Reactive Layer (Local Patch)**:
  - Khi một trạm đổi pin dự kiến gặp sự cố hoặc cạn pin ($avail_f: 1 \to 0$), hệ thống **lập tức phát hiện và sửa cục bộ đoạn tuyến trong Mutable Suffix** sang trạm thay thế khả dụng gần nhất có chi phí phát sinh nhỏ nhất.
  - **Giữ nguyên 100% tính toàn vẹn của Frozen Prefix** (các điểm shipper đã hoàn thành).
  - Phản hồi cực nhanh (**Latency < 10ms**, vượt xa yêu cầu < 1.5s).
  - Đẩy cập nhật ngay lập tức xuống client thông qua **WebSocket** thời gian thực.

---

## 🏗️ Cấu trúc thư mục

```
evpr-bss/
├── backend/
│   ├── app/
│   │   ├── main.py                  # Khởi tạo FastAPI app, lifespan, static UI mount
│   │   ├── config.py                # Cấu hình tham số xe, pin, ALNS, DB
│   │   │
│   │   ├── api/                     # REST & WebSocket API endpoints
│   │   │   ├── routes_orders.py     # CRUD đơn hàng
│   │   │   ├── routes_stations.py   # Lấy danh sách trạm & PATCH cập nhật trạng thái
│   │   │   ├── routes_plan.py       # POST /plan/optimize trigger ALNS
│   │   │   ├── routes_tracking.py   # Lấy tuyến active & POST complete stop
│   │   │   ├── routes_demo.py       # Reset DB & điều khiển simulator
│   │   │   └── ws_realtime.py       # WebSocket /ws/route/{shipper_id}
│   │   │
│   │   ├── core/                    # Thuật toán cốt lõi
│   │   │   ├── cost.py              # Tính khoảng cách Euclidean, năng lượng, chi phí đổi pin
│   │   │   ├── feasibility.py       # Kiểm tra ràng buộc tải trọng, pin, thứ tự pickup-delivery
│   │   │   ├── alns/                # Tầng ALNS Static Layer
│   │   │   │   ├── solution.py          # Solution representation
│   │   │   │   ├── destroy_operators.py # Random, Worst-cost, Shaw, Redundant Station Removal
│   │   │   │   ├── repair_operators.py  # Greedy, Regret-2, Charging-Aware Insertion
│   │   │   │   ├── acceptance.py        # Simulated Annealing
│   │   │   │   ├── weights.py           # Adaptive weight update & Roulette Wheel
│   │   │   │   └── alns_runner.py       # ALNS Optimization Loop
│   │   │   └── reactive/            # Tầng phản ứng thời gian thực
│   │   │       └── local_patch.py   # Frozen Prefix vs Mutable Suffix local repair
│   │   │
│   │   ├── models/                  # SQLAlchemy ORM Models (Order, Station, Route, RouteStop, EventLog)
│   │   ├── schemas/                 # Pydantic Schemas
│   │   ├── services/                # Business services & async Event Bus
│   │   ├── mock/                    # SwapStationSimulator (Auto & Manual mock)
│   │   ├── db/                      # SQLite engine, init DB & Seed data
│   │   └── static/                  # Web Mini App Demo (HTML, CSS, JS Canvas)
│   │
│   ├── tests/                       # Bộ kiểm thử tự động (21 tests)
│   │   ├── test_cost.py
│   │   ├── test_feasibility.py
│   │   ├── test_alns_static.py
│   │   ├── test_reactive_patch.py
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

### 2. Chạy toàn bộ Automated Test Suite (21 tests)

```bash
uv run pytest -v
```

### 3. Khởi động Web Server & Dashboard Demo

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

1. Mở trình duyệt tại **`http://localhost:8000/demo`**.
2. Nhấn nút **"⚡ Run ALNS Optimize"**:
   - Thuật toán ALNS chạy lập kế hoạch tuyến ban đầu. Tuyến đường được vẽ trực quan trên Canvas map kèm thứ tự các điểm dừng (Depot $\to$ Pickups $\to$ Deliveries $\to$ Ghé trạm đổi pin BSS Gamma).
3. Nhấn **"▶️ Complete Next Stop"** 1-2 lần:
   - Mô phỏng shipper di chuyển qua các điểm đầu tiên. Các điểm này chuyển sang trạng thái **Frozen Prefix (🔒 Done)** và không thể bị sửa đổi.
4. Tại bảng **Battery Swap Stations (BSS)** ở cột phải, nhấn nút **"⚡ Available"** của **BSS Gamma - South East** để chuyển sang **"⚠️ DOWN"**:
   - Ngay lập tức trong chưa đầy **10 mili-giây**:
     - Tầng **Reactive Layer (Local Patch)** phát hiện trạm hỏng nằm trong Mutable Suffix.
     - Lựa chọn trạm thay thế khả thi gần nhất (**BSS Delta**).
     - Hệ thống phát tín hiệu qua **WebSocket**.
     - Web Mini App hiển thị **Banner thông báo động** và cập nhật bản đồ ngay lập tức mà không làm gián đoạn shipper!
