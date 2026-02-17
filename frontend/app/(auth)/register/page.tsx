// Register Page
import { Metadata } from 'next';
import RegisterForm from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Register | Crypto Casino',
  description: 'Create your Crypto Casino account',
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <RegisterForm />
    </div>
  );
}


// export default function RegisterPage() {
//   return (
//     <div className="min-h-screen flex items-center justify-center p-4">
//       <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />
//       <RegisterForm />
//     </div>
//   );
// }
