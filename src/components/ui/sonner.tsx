import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-foreground group-[.toaster]:text-background group-[.toaster]:border-none group-[.toaster]:shadow-2xl group-[.toaster]:rounded-full group-[.toaster]:px-6 group-[.toaster]:py-3 group-[.toaster]:font-medium group-[.toaster]:text-sm",
          description: "group-[.toast]:text-background/70",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-full group-[.toast]:font-bold",
          cancelButton: "group-[.toast]:bg-background/20 group-[.toast]:text-background group-[.toast]:rounded-full",
          closeButton: "group-[.toast]:text-background/70 group-[.toast]:hover:text-background",
          error: "group-[.toaster]:bg-destructive group-[.toaster]:text-destructive-foreground",
          success: "group-[.toaster]:bg-foreground group-[.toaster]:text-background",
        },
      }}
      closeButton
      {...props}
    />
  );
};

export { Toaster, toast };
