import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ChatService, type ChatProduct, type ChatTurn } from '../../../core/services/chat.service';
import { Icon } from '../icon/icon';
import { formatCurrency } from '../../../core/utils/format';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  products?: ChatProduct[];
  suggestions?: string[];
}

let messageId = 0;

const OPENING: Omit<Message, 'id'> = {
  role: 'assistant',
  text: 'Hello. Ask me whether a piece is in stock, how to care for oxidised silver, or about shipping and returns.',
  suggestions: [
    'Do you have the jhumkas in stock?',
    'How do I stop it tarnishing?',
    'What is your return policy?',
  ],
};

/**
 * The store assistant, shared by every storefront page.
 *
 * The panel is rendered unconditionally and revealed with CSS rather than being added to the DOM when
 * opened. A panel that did not exist until the button was clicked could not animate open, and would
 * have to be created during the same tick as the click.
 *
 * Nothing here decides what an answer should be — that is the server's job, against live stock and
 * the live settings. Keeping the client dumb is what stops the site and the app from contradicting
 * each other about whether something is in stock or what delivery costs.
 */
@Component({
  selector: 'app-chat-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.css',
})
export class ChatWidget {
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly open = signal(false);
  readonly draft = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly messages = signal<Message[]>([{ ...OPENING, id: 0 }]);

  readonly canSend = computed(() => this.draft().trim().length > 0 && !this.busy());

  toggle(): void {
    this.open.update((value) => !value);

    if (!this.open()) {
      this.reset();
    }
  }

  close(): void {
    this.open.set(false);
    this.reset();
  }

  /** Reset on close so a reopened panel starts clean. The thread is not persisted anywhere. */
  private reset(): void {
    this.messages.set([{ ...OPENING, id: 0 }]);
    this.draft.set('');
    this.error.set(null);
    this.busy.set(false);
  }

  async send(text?: string): Promise<void> {
    const message = (text ?? this.draft()).trim();

    if (!message || this.busy()) {
      return;
    }

    this.draft.set('');
    this.error.set(null);
    this.busy.set(true);
    this.append({ role: 'user', text: message });

    // Only real exchanges are sent back. The opening greeting is a prompt, not an answer to anything,
    // so including it would teach the assistant a turn that never happened.
    const history: ChatTurn[] = this.messages()
      .filter((entry) => entry.role === 'assistant' && entry.id !== 0)
      .map((entry) => ({ role: entry.role, content: entry.text }));

    try {
      const reply = await this.chat.ask(message, history);

      this.append({
        role: 'assistant',
        text: reply.reply,
        products: reply.products?.length ? reply.products : undefined,
        suggestions: reply.suggestions?.length ? reply.suggestions : undefined,
      });
    } catch (caught) {
      this.error.set(caught instanceof Error ? caught.message : 'Could not reach the assistant.');
    } finally {
      this.busy.set(false);
    }
  }

  openProduct(slug: string): void {
    this.close();
    void this.router.navigate(['/product', slug]);
  }

  private append(entry: Omit<Message, 'id'>): void {
    messageId += 1;
    this.messages.update((current) => [...current, { ...entry, id: messageId }]);
    this.scrollToEnd();
  }

  private scrollToEnd(): void {
    // Deferred so the new bubble is in the DOM before it is scrolled to.
    setTimeout(() => {
      const element = this.scroller()?.nativeElement;

      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  money(value: number, currency: string): string {
    return formatCurrency(value, currency);
  }
}