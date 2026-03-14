-- 创建quality_feedback表（客户评价）

CREATE TABLE IF NOT EXISTS quality_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  batchNo VARCHAR(50),
  customerName VARCHAR(100),
  rating INT NOT NULL COMMENT '评分（1-5星）',
  comment TEXT COMMENT '评价内容',
  images TEXT COMMENT 'JSON数组，存储图片URL列表',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orderId (orderId),
  INDEX idx_batchNo (batchNo),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户质量评价表';
