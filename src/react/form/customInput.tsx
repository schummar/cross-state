import type { ReactNode } from 'react';

export interface CustomInputProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  children?: ReactNode;
}

export function CustomInput({ name, children, ...props }: CustomInputProps): JSX.Element {
  return (
    <div
      {...props}
      style={{
        position: 'relative',
        ...props.style,
      }}
    >
      {children}

      <input
        name={name}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          opacity: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
