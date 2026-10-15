"""Held-out AUC and precision among the riskiest slice."""

from __future__ import annotations

import math
from typing import Sequence


def roc_auc(labels: Sequence[int], scores: Sequence[float]) -> float | None:
    pairs = [(float(s), int(y)) for s, y in zip(scores, labels, strict=True)]
    positives = sum(y for _, y in pairs)
    negatives = len(pairs) - positives
    if positives == 0 or negatives == 0 or len(pairs) < 2:
        return None
    pairs.sort(key=lambda item: item[0])
    rank_sum = 0.0
    i = 0
    while i < len(pairs):
        j = i
        while j + 1 < len(pairs) and pairs[j + 1][0] == pairs[i][0]:
            j += 1
        # Average rank for ties, ranks are 1-based.
        avg_rank = (i + 1 + j + 1) / 2
        for k in range(i, j + 1):
            if pairs[k][1] == 1:
                rank_sum += avg_rank
        i = j + 1
    auc = (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)
    if math.isnan(auc):
        return None
    return round(max(0.0, min(1.0, auc)), 4)


def precision_at_top_fraction(labels: Sequence[int], scores: Sequence[float], fraction: float = 0.1) -> float | None:
    if not labels:
        return None
    k = max(1, math.ceil(len(labels) * fraction))
    order = sorted(range(len(labels)), key=lambda i: scores[i], reverse=True)[:k]
    hits = sum(int(labels[i]) for i in order)
    return round(hits / k, 4)


def held_out_split(n: int, labels: Sequence[int], fraction: float = 0.2, seed: int = 7) -> tuple[list[int], list[int]]:
    """Deterministic stratified split. Returns train indices, test indices."""
    import random

    rng = random.Random(seed)
    pos = [i for i, y in enumerate(labels) if int(y) == 1]
    neg = [i for i, y in enumerate(labels) if int(y) == 0]
    rng.shuffle(pos)
    rng.shuffle(neg)

    def take(ids: list[int]) -> tuple[list[int], list[int]]:
        if len(ids) < 2:
            return ids, []
        n_test = max(1, int(round(len(ids) * fraction)))
        n_test = min(n_test, len(ids) - 1)
        return ids[n_test:], ids[:n_test]

    tr_p, te_p = take(pos)
    tr_n, te_n = take(neg)
    train = tr_p + tr_n
    test = te_p + te_n
    if len(test) < 8 or len(train) < 8:
        # Not enough to quote a metric. Caller trains on everything.
        return list(range(n)), []
    rng.shuffle(train)
    rng.shuffle(test)
    return train, test
