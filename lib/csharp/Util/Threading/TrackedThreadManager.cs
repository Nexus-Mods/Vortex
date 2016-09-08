using System.Collections.Generic;

namespace Util.Threading
{
	/// <summary>
	/// Provides access to the tracked threads.
	/// </summary>
	public static class TrackedThreadManager
	{
		private static readonly object m_objLock = new object();
		private static readonly List<TrackedThread> m_lstTrackedThreads = new List<TrackedThread>();

		#region Properties

		/// <summary>
		/// Gets the collection of threads being tracked.
		/// </summary>
		/// <value>The collection of threads being tracked.</value>
		public static TrackedThread[] Threads
		{
			get
			{
				return m_lstTrackedThreads.ToArray();
			}
		}

		#endregion

		/// <summary>
		/// Adds a thread to the tracker.
		/// </summary>
		/// <param name="p_ttdThread">The thread to be tracked.</param>
		public static void AddThread(TrackedThread p_ttdThread)
		{
			lock (m_objLock)
			{
				if (!m_lstTrackedThreads.Contains(p_ttdThread))
					m_lstTrackedThreads.Add(p_ttdThread);
			}
		}

		/// <summary>
		/// Removes a thread from the tracker.
		/// </summary>
		/// <param name="p_ttdThread">The thread that was tracked.</param>
		public static void RemoveThread(TrackedThread p_ttdThread)
		{
			lock (m_objLock)
			{
				m_lstTrackedThreads.Remove(p_ttdThread);
			}
		}
	}
}
