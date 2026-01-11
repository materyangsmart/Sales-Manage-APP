import React from 'react';

interface AmountProps {
  /**
   * 金额（单位：分）
   */
  value: number;
  /**
   * 是否显示货币符号
   */
  showSymbol?: boolean;
  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * 金额显示组件
 * 自动将"分"转换为"元"并格式化显示
 */
export const Amount: React.FC<AmountProps> = ({
  value,
  showSymbol = true,
  className = '',
}) => {
  const yuan = (value / 100).toFixed(2);
  
  return (
    <span className={className}>
      {showSymbol && '¥'}
      {yuan}
    </span>
  );
};

interface AmountInputProps {
  /**
   * 金额（单位：分）
   */
  value?: number;
  /**
   * 变更回调
   */
  onChange?: (value: number) => void;
  /**
   * 占位符
   */
  placeholder?: string;
  /**
   * 是否禁用
   */
  disabled?: boolean;
  /**
   * 最大值（单位：分）
   */
  max?: number;
  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * 金额输入组件
 * 用户输入"元"，自动转换为"分"
 */
export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  placeholder = '请输入金额',
  disabled = false,
  max,
  className = '',
}) => {
  const yuan = value !== undefined ? (value / 100).toFixed(2) : '';
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // 允许空值
    if (inputValue === '') {
      onChange?.(0);
      return;
    }
    
    // 验证输入格式（最多两位小数）
    const regex = /^\d+(\.\d{0,2})?$/;
    if (!regex.test(inputValue)) {
      return;
    }
    
    // 转换为分
    const fen = Math.round(parseFloat(inputValue) * 100);
    
    // 检查最大值
    if (max !== undefined && fen > max) {
      return;
    }
    
    onChange?.(fen);
  };
  
  return (
    <div className={`flex items-center ${className}`}>
      <span className="mr-2 text-gray-600">¥</span>
      <input
        type="text"
        value={yuan}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
    </div>
  );
};
