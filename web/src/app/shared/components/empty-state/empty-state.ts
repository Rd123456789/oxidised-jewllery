import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, type IconName } from '../icon/icon';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="ox-card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-sand text-brass">
        <app-icon [name]="icon()" [size]="22" />
      </span>
      <h3 class="font-display text-xl text-ink">{{ title() }}</h3>
      @if (message()) {
        <p class="max-w-md text-sm text-ink-soft">{{ message() }}</p>
      }
      @if (actionLabel() && actionLink()) {
        <a class="ox-btn ox-btn--primary mt-2" [routerLink]="actionLink()!">{{ actionLabel() }}</a>
      }
    </div>
  `,
})
export class EmptyState {
  readonly title = input('Nothing here yet');
  readonly message = input<string | undefined>(undefined);
  readonly icon = input<IconName>('box');
  readonly actionLabel = input<string | undefined>(undefined);
  readonly actionLink = input<string | undefined>(undefined);
}
