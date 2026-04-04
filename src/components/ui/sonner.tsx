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
            "group toast group-[.toaster]:bg-foreground group-[.toaster]:text-background group-[.toaster]:border-none group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:px-5 group-[.toaster]:py-3 group-[.toaster]:font-medium group-[.toaster]:text-xs group-[.toaster]:max-w-xl group-[.toaster]:w-[420px]",
          description: "group-[.toast]:text-background/70",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-bold",
          cancelButton: "group-[.toast]:bg-background/20 group-[.toast]:text-background group-[.toast]:rounded-lg",
          closeButton: "group-[.toast]:text-background/70 group-[.toast]:hover:text-background",
          error: "!bg-destructive !text-destructive-foreground",
          success: "!bg-emerald-700 !text-white",
          warning: "!bg-amber-600 !text-white",
        },
      }}
      closeButton
      {...props}
    />
  );
};

export { Toaster, toast };
