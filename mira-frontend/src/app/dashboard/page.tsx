/** @format */
export default function DashboardPage() {
	return (
		<div className="p-6">
			<h1 className="text-3xl font-semibold text-[#62445E]">Dashboard</h1>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
				<div className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition">
					<h2 className="text-xl font-medium mb-2">Active Projects</h2>
					<p className="text-gray-600">3 ongoing</p>
				</div>

				<div className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition">
					<h2 className="text-xl font-medium mb-2">Team Members</h2>
					<p className="text-gray-600">8 contributors</p>
				</div>

				<div className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition">
					<h2 className="text-xl font-medium mb-2">Updates</h2>
					<p className="text-gray-600">5 recent commits</p>
				</div>
			</div>
		</div>
	);
}
