import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ title, children }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pl-64">
        <Header title={title} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
