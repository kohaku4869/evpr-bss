import asyncio
import json
from typing import Dict, Set, List, Callable, Any, Optional
from fastapi import WebSocket


class EventBus:
    def __init__(self):
        # Sequential FIFO event queue to prevent race conditions
        self.queue: asyncio.Queue = asyncio.Queue()
        self.subscribers: Dict[str, List[Callable]] = {}
        # Active websocket connections keyed by shipper_id
        self.ws_clients: Dict[int, Set[WebSocket]] = {}
        self._worker_task: Optional[asyncio.Task] = None

    def start_worker(self):
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._process_queue())

    async def stop_worker(self):
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass

    def subscribe(self, event_type: str, callback: Callable):
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)

    async def publish(self, event_type: str, **kwargs):
        """Enqueues an event for sequential processing."""
        await self.queue.put((event_type, kwargs))

    async def _process_queue(self):
        while True:
            try:
                event_type, data = await self.queue.get()
                callbacks = self.subscribers.get(event_type, [])
                for cb in callbacks:
                    try:
                        if asyncio.iscoroutinefunction(cb):
                            await cb(**data)
                        else:
                            cb(**data)
                    except Exception as e:
                        print(f"[EventBus] Error in callback {cb}: {e}")
                self.queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[EventBus] Error processing queue event: {e}")

    # WebSocket connection management
    async def connect_ws(self, shipper_id: int, websocket: WebSocket):
        await websocket.accept()
        if shipper_id not in self.ws_clients:
            self.ws_clients[shipper_id] = set()
        self.ws_clients[shipper_id].add(websocket)

    def disconnect_ws(self, shipper_id: int, websocket: WebSocket):
        if shipper_id in self.ws_clients:
            self.ws_clients[shipper_id].discard(websocket)
            if not self.ws_clients[shipper_id]:
                del self.ws_clients[shipper_id]

    async def broadcast_to_shipper(self, shipper_id: int, message: Dict[str, Any]):
        clients = self.ws_clients.get(shipper_id, set()).copy()
        dead_clients = []
        for ws in clients:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead_clients.append(ws)

        for ws in dead_clients:
            self.disconnect_ws(shipper_id, ws)

    async def broadcast_all(self, message: Dict[str, Any]):
        for shipper_id in list(self.ws_clients.keys()):
            await self.broadcast_to_shipper(shipper_id, message)


event_bus = EventBus()
