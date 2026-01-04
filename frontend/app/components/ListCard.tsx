type ListNode = {
  id: number;
  name: string;
};

export default function ListCard({ list }: { list: ListNode }) {
  return (
    <div className="bg-gray-100 border border-gray-300 rounded p-6 hover:shadow-lg transition duration-200 cursor-pointer group">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 group-hover:text-blue-600 transition duration-200">
          {list.name}
        </h3>
        <svg className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
