/**
 * Toast Notifications Manager
 * Manages toast notifications
 */

import { Toast, ToastAction } from './types';

export class ToastManager {
  private container: HTMLElement | null = null;
  private toasts = new Map<string, Toast>();

  init(): void {
    this.container = document.getElementById('toast-container');
  }

  show(options: Omit<Toast, 'id'>): string {
    if (!this.container) {
      console.warn('Toast container not initialized');
      return '';
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = {
      id,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      duration: options.duration ?? 4000,
      actions: options.actions,
    };

    this.toasts.set(id, toast);
    this.render(toast);

    // Auto-dismiss after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.dismiss(id), toast.duration);
    }

    return id;
  }

  dismiss(id: string): void {
    const toast = this.toasts.get(id);
    if (!toast) return;

    const element = document.getElementById(id);
    if (element) {
      element.classList.add('removing');
      setTimeout(() => {
        element.remove();
        this.toasts.delete(id);
      }, 200);
    }
  }

  info(title: string, message?: string, actions?: ToastAction[]): string {
    return this.show({ type: 'info', title, message, actions });
  }

  success(title: string, message?: string, actions?: ToastAction[]): string {
    return this.show({ type: 'success', title, message, actions });
  }

  warning(title: string, message?: string, actions?: ToastAction[]): string {
    return this.show({ type: 'warning', title, message, actions });
  }

  error(title: string, message?: string, actions?: ToastAction[]): string {
    return this.show({ type: 'error', title, message, actions, duration: 6000 });
  }

  private render(toast: Toast): void {
    if (!this.container) return;

    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };

    let actionsHtml = '';
    if (toast.actions && toast.actions.length > 0) {
      actionsHtml = '<div class="toast-actions">';
      actionsHtml += toast.actions.map(action =>
        `<button class="toast-action-btn" data-action-id="${actions.length}">${action.label}</button>`
      ).join('');
      actionsHtml += '</div>';
    }

    const toastEl = document.createElement('div');
    toastEl.id = toast.id;
    toastEl.className = `toast ${toast.type}`;
    toastEl.innerHTML = `
      <div class="toast-icon">${icons[toast.type]}</div>
      <div class="toast-content">
        <div class="toast-title">${toast.title}</div>
        ${toast.message ? `<div class="toast-message">${toast.message}</div>` : ''}
        ${actionsHtml}
      </div>
    `;

    // Attach action listeners
    if (toast.actions) {
      toastEl.querySelectorAll('.toast-action-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => {
          toast.actions![index].action();
          this.dismiss(toast.id);
        });
      });
    }

    this.container.appendChild(toastEl);
  }

  clear(): void {
    this.toasts.forEach((_, id) => this.dismiss(id));
  }
}
