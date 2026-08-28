import math
import random


class SimulatedAnnealing:
    def __init__(self, start_temperature: float = 100.0, cooling_rate: float = 0.985):
        self.temperature = start_temperature
        self.cooling_rate = cooling_rate

    def accept(self, current_cost: float, candidate_cost: float) -> bool:
        if candidate_cost < current_cost:
            return True
        if self.temperature <= 1e-8:
            return False
        delta = candidate_cost - current_cost
        probability = math.exp(-delta / self.temperature)
        return random.random() < probability

    def cool(self):
        self.temperature = max(1e-8, self.temperature * self.cooling_rate)

    def reset(self, start_temperature: float = 100.0):
        self.temperature = start_temperature
