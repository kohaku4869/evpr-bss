from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.event_bus import event_bus

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/route/{shipper_id}")
async def websocket_route_endpoint(websocket: WebSocket, shipper_id: int):
    await event_bus.connect_ws(shipper_id, websocket)
    try:
        # Keep connection open and listen for optional ping/messages from client
        while True:
            data = await websocket.receive_text()
            # Respond to ping or client queries
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        event_bus.disconnect_ws(shipper_id, websocket)
    except Exception:
        event_bus.disconnect_ws(shipper_id, websocket)
