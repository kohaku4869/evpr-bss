import random
from typing import List, Callable, Dict, Any
from app.config import settings


class OperatorTracker:
    def __init__(self, name: str, func: Callable):
        self.name = name
        self.func = func
        self.weight: float = 1.0
        self.score: float = 0.0
        self.invocations: int = 0


class AdaptiveWeights:
    def __init__(
        self,
        destroy_operators: List[Tuple_Operator := Any],
        repair_operators: List[Tuple_Operator := Any],
        reaction_factor: float = settings.ALNS_REACTION_FACTOR,
        segment_length: int = settings.ALNS_SEGMENT_LENGTH
    ):
        self.reaction_factor = reaction_factor
        self.segment_length = segment_length

        self.destroy_ops: List[OperatorTracker] = [OperatorTracker(name, fn) for name, fn in destroy_operators]
        self.repair_ops: List[OperatorTracker] = [OperatorTracker(name, fn) for name, fn in repair_operators]

    def _select(self, ops: List[OperatorTracker]) -> OperatorTracker:
        total_weight = sum(op.weight for op in ops)
        if total_weight <= 0:
            return random.choice(ops)

        r = random.uniform(0, total_weight)
        cumulative = 0.0
        for op in ops:
            cumulative += op.weight
            if cumulative >= r:
                return op
        return ops[-1]

    def select_destroy(self) -> OperatorTracker:
        op = self._select(self.destroy_ops)
        op.invocations += 1
        return op

    def select_repair(self) -> OperatorTracker:
        op = self._select(self.repair_ops)
        op.invocations += 1
        return op

    def reward(self, destroy_op: OperatorTracker, repair_op: OperatorTracker, score: float):
        destroy_op.score += score
        repair_op.score += score

    def update_segment_weights(self):
        for ops in (self.destroy_ops, self.repair_ops):
            for op in ops:
                if op.invocations > 0:
                    op.weight = (1.0 - self.reaction_factor) * op.weight + self.reaction_factor * (op.score / op.invocations)
                # Ensure a minimum weight so operators don't get completely eliminated
                op.weight = max(0.1, op.weight)
                op.score = 0.0
                op.invocations = 0
