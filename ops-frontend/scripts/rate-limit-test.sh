#!/bin/bash
echo "===== Rate Limiting 429 测试 ====="
for i in $(seq 1 65); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/products?pageSize=1)
  if [ "$STATUS" = "429" ]; then
    echo "第 ${i} 次请求: HTTP $STATUS (Rate Limited)"
    echo "--- 429 响应体 ---"
    curl -s http://localhost:3000/api/v1/products?pageSize=1 | python3 -m json.tool
    break
  fi
  if [ $((i % 10)) -eq 0 ]; then
    echo "第 ${i} 次请求: HTTP $STATUS"
  fi
done
echo "===== 测试完成 ====="
