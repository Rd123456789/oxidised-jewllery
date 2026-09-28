import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'info' | 'progress' | 'success' | 'danger';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="ox-badge" [class]="toneClass()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly label = input.required<string>();
  readonly tone = input<BadgeTone>('neutral');

  toneClass(): string {
    return `ox-badge--${this.tone()}`;
  }
}
