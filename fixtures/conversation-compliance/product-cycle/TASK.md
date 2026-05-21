# Product Cycle Fixture

Implement `insightScore(viewCount, likeCount, commentCount)` in `src/insights.mjs`.

Scoring formula:

```text
round(viewCount * 0.1) + likeCount * 10 + commentCount * 25
```

Validation:

- Throw `TypeError` when any metric is not a finite number.
- Throw `RangeError` when any metric is negative.
- Run `npm test`.
