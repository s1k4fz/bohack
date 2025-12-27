import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'gray' | 'blue' | 'purple' | 'amber' | 'red' | 'pink' | 'green' | 'teal'
  size?: 'lg' | 'md' | 'sm'
  subtle?: boolean
  icon?: React.ReactNode
}

// Vercel Design System 颜色映射
const variantStyles = {
  gray: {
    solid: 'bg-[#8f8f8f] text-[#0a0a0a]',
    subtle: 'bg-[#1f1f1f] text-[#ededed]',
  },
  blue: {
    solid: 'bg-[#0072f5] text-[#0a0a0a]',
    subtle: 'bg-[#10233d] text-[#52a8ff]',
  },
  purple: {
    solid: 'bg-[#8e4ec6] text-[#0a0a0a]',
    subtle: 'bg-[#2e1938] text-[#bf7af0]',
  },
  amber: {
    solid: 'bg-[#ffb224] text-black',
    subtle: 'bg-[#331b00] text-[#ff990a]',
  },
  red: {
    solid: 'bg-[#e5484d] text-[#0a0a0a]',
    subtle: 'bg-[#3c1618] text-[#ff6166]',
  },
  pink: {
    solid: 'bg-[#ea3e83] text-[#0a0a0a]',
    subtle: 'bg-[#3a1726] text-[#f75f8f]',
  },
  green: {
    solid: 'bg-[#45a557] text-[#0a0a0a]',
    subtle: 'bg-[#0f2e18] text-[#62c073]',
  },
  teal: {
    solid: 'bg-[#12a594] text-[#0a0a0a]',
    subtle: 'bg-[#062822] text-[#0ac7b4]',
  },
}

const sizeStyles = {
  lg: 'h-8 px-3 gap-1.5 text-sm',
  md: 'h-6 px-2.5 gap-1 text-xs',
  sm: 'h-5 px-1.5 gap-0.5 text-[11px]',
}

const iconSizes = {
  lg: 'w-3.5 h-3.5',
  md: 'w-3 h-3',
  sm: 'w-2.5 h-2.5',
}

export function Badge({ 
  className,
  variant = 'gray',
  size = 'md',
  subtle = false,
  icon,
  children,
  ...props 
}: BadgeProps) {
  const colorStyle = subtle ? variantStyles[variant].subtle : variantStyles[variant].solid
  
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium',
        colorStyle,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon && (
        <span className={cn('shrink-0', iconSizes[size])}>
          {icon}
        </span>
      )}
      {children}
    </div>
  )
}

