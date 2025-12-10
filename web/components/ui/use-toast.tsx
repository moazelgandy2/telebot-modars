// Simplified mock for toast
export interface ToastProps {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}

export const toast = ({ title, description, variant }: ToastProps) => {
  console.log(`Toast [${variant || 'default'}]: ${title} - ${description}`);
};

export function useToast() {
  return { toast };
}
