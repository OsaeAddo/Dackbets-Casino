export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md"> {/* Consistent width container */}
        {children}
      </div>
    </div>
  );
}

// export default function AuthLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
//       {children}
//     </div>
//   );
// }