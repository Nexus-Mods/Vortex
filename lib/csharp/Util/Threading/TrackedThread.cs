using System.Threading;

namespace Util.Threading
{
	/// <summary>
	/// A thread that is tracked by the <see cref="TrackedThreadManager"/>.
	/// </summary>
	public class TrackedThread
	{
		private readonly Thread m_thdThread = null;
		private readonly ParameterizedThreadStart m_ptsThreadMethod = null;
		private readonly ThreadStart m_tdsThreadMethod = null;

		#region Properties

		/// <summary>
		/// Gets the managed thread being tracked.
		/// </summary>
		/// <value>The managed thread being tracked.</value>
		public Thread Thread
		{
			get
			{
				return this.m_thdThread;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// Initializes the object with the given values.
		/// </summary>
		/// <param name="p_ptsThreadMethod">The method to call when the thread starts.</param>
		public TrackedThread(ParameterizedThreadStart p_ptsThreadMethod)
		{
			m_ptsThreadMethod = p_ptsThreadMethod;
			m_thdThread = new Thread(RunParameterizedThread);
			TrackedThreadManager.AddThread(this);
		}

		/// <summary>
		/// Initializes the object with the given values.
		/// </summary>
		/// <param name="p_tdsThreadMethod">The method to call when the thread starts.</param>
		public TrackedThread(ThreadStart p_tdsThreadMethod)
		{
			m_tdsThreadMethod = p_tdsThreadMethod;
			m_thdThread = new Thread(RunThread);
			TrackedThreadManager.AddThread(this);
		}

		#endregion
		
		/// <summary>
		/// Executes the paramterized method from within the thread.
		/// </summary>
		/// <remarks>
		/// Once the method returns, the thread is removed from the <see cref="TrackedThreadManager"/>
		/// and exits.
		/// </remarks>
		/// <param name="p_objParam">The parameter to pass to the thread.</param>
		private void RunParameterizedThread(object p_objParam)
		{
			try
			{
				this.m_ptsThreadMethod(p_objParam);
			}
			finally
			{
				TrackedThreadManager.RemoveThread(this);
			}
		}

		/// <summary>
		/// Executes the non-parameterized method from within the thread.
		/// </summary>
		/// <remarks>
		/// Once the method returns, the thread is removed from the <see cref="TrackedThreadManager"/>
		/// and exits.
		/// </remarks>
		private void RunThread()
		{
			try
			{
				this.m_tdsThreadMethod();
			}
			finally
			{
				TrackedThreadManager.RemoveThread(this);
			}
		}

		/// <summary>
		/// Starts the thread.
		/// </summary>
		public void Start()
		{
			m_thdThread.Start();
		}

		/// <summary>
		/// Starts the thread.
		/// </summary>
		/// <param name="p_objParam">The parameter to pass to the thread.</param>
		public void Start(object p_objParam)
		{
			m_thdThread.Start(p_objParam);
		}
	}
}
