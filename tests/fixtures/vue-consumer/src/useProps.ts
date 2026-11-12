import type { ComposableProps } from './types';

export function useProps(props: ComposableProps): string {
  return props.label + props.detail;
}
