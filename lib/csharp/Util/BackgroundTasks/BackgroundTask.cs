using System;
using System.ComponentModel;
using System.Linq.Expressions;

namespace Util.BackgroundTasks
{
	/// <summary>
	/// A base class for tasks that run in a background thread.
	/// </summary>
	/// <remarks>
	/// This class implements some base functionality, making writing backgounrd tasks
	/// simpler.
	/// 
	/// This base class does not create a thread. It is meant for tasks that
	/// either don't need another thread, or will be responsible for threading
	/// themselves. If threading management is desired, use
	/// <see cref="ThreadedBackgroundTask"/> instead.
	/// </remarks>
	/// <seealso cref="ThreadedBackgroundTask"/>
	public class BackgroundTask : INotifyPropertyChanged, IBackgroundTask
	{
		#region Events

		/// <summary>
		/// Raised when the task has ended.
		/// </summary>
		public event EventHandler<TaskEndedEventArgs> TaskEnded = delegate { };

		#endregion

		#region INotifyPropertyChanged Members

		/// <summary>
		/// Raised when certain properties of the object change.
		/// </summary>
		public event PropertyChangedEventHandler PropertyChanged = delegate { };

		#endregion

		private readonly object LOCK_OBJECT = new object();

		private TaskStatus m_tstStatus = TaskStatus.Running;
		private TaskStatus m_tstInnerStatus = TaskStatus.Running;

		private volatile string m_strOverallMessage = null;
		private volatile bool m_booShowOverallProgressAsMarquee = false;
		private Int64 m_intOverallProgress = 0;
		private Int64 m_intOverallProgressMinimum = 0;
		private Int64 m_intOverallProgressMaximum = 100;
		private volatile Int32 m_intOverallProgressStepSize = 1;
		private volatile bool m_booShowItemProgress = false;
		private volatile bool m_booShowItemProgressAsMarquee = false;
		private volatile string m_strItemMessage = null;
		private Int64 m_intItemProgress = 0;
		private Int64 m_intItemProgressMinimum = 0;
		private Int64 m_intItemProgressMaximum = 100;
		private volatile Int32 m_intItemProgressStepSize = 1;
		private volatile Int32 m_intItemSpeed = 0;
		private volatile Int32 m_intActiveThreads = 0;
		private bool m_booIsRemote = false;

		#region Properties


		/// <summary>
		/// Gets the status of the task.
		/// </summary>
		/// <value>The status of the task.</value>
		public TaskStatus Status
		{
			get
			{
				return m_tstStatus;
			}
			protected set
			{
				if (m_tstStatus != value)
				{
					bool booIsActive = IsActive;
					m_tstStatus = value;
					OnPropertyChanged(new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => Status)));
					if (booIsActive != IsActive)
						OnPropertyChanged(new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => IsActive)));
				}
			}
		}

 		/// <summary>
		/// Gets the status of the eventual nested task.
		/// </summary>
		/// <value>The status of the eventual nested task.</value>
		public TaskStatus InnerTaskStatus
		{
			get
			{
				return m_tstInnerStatus;
			}
			protected set
			{
				if (m_tstInnerStatus != value)
				{
					m_tstInnerStatus = value;
					OnPropertyChanged(new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(() => InnerTaskStatus)));
				}
			}
		}

		/// <summary>
		/// Gets the return value of the task.
		/// </summary>
		/// <remarks>
		/// This value should be used in conjunction with <see cref="Status"/>.
		/// </remarks>
		/// <value>The return value of the task.</value>
		public object ReturnValue { get; private set; }

		/// <summary>
		/// Gets whether or not the task is actively working.
		/// </summary>
		/// <remarks>
		/// This is shorthand for checking if the <see cref="Status"/>
		/// is either <see cref="TaskStatus.Running"/> or <see cref="TaskStatus.Cancelling"/>.
		/// </remarks>
		/// <value>Whether or not the task is actively working.</value>
		public bool IsActive
		{
			get
			{
				return (Status == TaskStatus.Cancelling) || (Status == TaskStatus.Running);
			}
		}

		/// <summary>
		/// Gets whether or not the task is remote.
		/// </summary>
		/// <remarks>
		/// This is shorthand for checking if the task
		/// is either remote or local.
		/// </remarks>
		/// <value>Whether or not the task is remote.</value>
		public virtual bool IsRemote
		{
			get { return m_booIsRemote; }
			set { m_booIsRemote = value; }
		}

		/// <summary>
		/// Gets whether the task supports pausing.
		/// </summary>
		/// <value>Thether the task supports pausing.</value>
		public virtual bool SupportsPause
		{
			get
			{
				return false;
			}
		}

		/// <summary>
		/// Gets whether the task supports pausing.
		/// </summary>
		/// <value>Thether the task supports pausing.</value>
		public virtual bool SupportsQueue
		{
			get
			{
				return false;
			}
		}

		/// <summary>
		/// Gets whether the task supports retrying.
		/// </summary>
		/// <value>Thether the task supports retrying.</value>
		public virtual bool SupportsRetry
		{
			get
			{
				return false;
			}
		}

		/// <summary>
		/// Gets the current task speed.
		/// </summary>
		/// <value>The current task speed.</value>
		public Int32 TaskSpeed
		{
			get
			{
				return m_intItemSpeed;
			}
			set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intItemSpeed != value)
					{
						booChanged = true;
						m_intItemSpeed = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => TaskSpeed);
			}
		}

		/// <summary>
		/// Gets the number of currently active threads.
		/// </summary>
		/// <value>The number of currently active threads.</value>
		public virtual Int32 ActiveThreads
		{
			get
			{
				return m_intActiveThreads;
			}
			set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intActiveThreads != value)
					{
						booChanged = true;
						m_intActiveThreads = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => ActiveThreads);
			}
		}

		#region Overall Progress

		/// <summary>
		/// Gets the message shown above the total progress bar.
		/// </summary>
		/// <value>The message shown above the total progress bar.</value>
		public string OverallMessage
		{
			get
			{
				return m_strOverallMessage;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (((m_strOverallMessage == null) && (value != null)) ||
						((m_strOverallMessage != null) && !m_strOverallMessage.Equals(value)))
					{
						booChanged = true;
						m_strOverallMessage = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => OverallMessage);
			}
		}

		/// <summary>
		/// Gets whether to display the overall progress bar as a marquee.
		/// </summary>
		/// <value>Whether to display the overall progress bar as a marquee.</value>
		public bool ShowOverallProgressAsMarquee
		{
			get
			{
				return m_booShowOverallProgressAsMarquee;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_booShowOverallProgressAsMarquee != value)
					{
						booChanged = true;
						m_booShowOverallProgressAsMarquee = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => ShowOverallProgressAsMarquee);
			}
		}

		/// <summary>
		/// Gets the progress on the overall work.
		/// </summary>
		/// <value>The progress on the overall work.</value>
		public Int64 OverallProgress
		{
			get
			{
				return m_intOverallProgress;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intOverallProgress != value)
					{
						booChanged = true;
						m_intOverallProgress = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => OverallProgress);
			}
		}

		/// <summary>
		/// Gets the minimum value on the overall progress bar.
		/// </summary>
		/// <value>The minimum value on the overall progress bar.</value>
		public Int64 OverallProgressMinimum
		{
			get
			{
				return m_intOverallProgressMinimum;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intOverallProgressMinimum != value)
					{
						booChanged = true;
						m_intOverallProgressMinimum = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => OverallProgressMinimum);
			}
		}

		/// <summary>
		/// Gets the maximum value on the overall progress bar.
		/// </summary>
		/// <value>The maximum value on the overall progress bar.</value>
		public Int64 OverallProgressMaximum
		{
			get
			{
				return m_intOverallProgressMaximum;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intOverallProgressMaximum != value)
					{
						booChanged = true;
						m_intOverallProgressMaximum = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => OverallProgressMaximum);
			}
		}

		/// <summary>
		/// Gets the step size of the overall progress bar.
		/// </summary>
		/// <value>The step size of the overall progress bar.</value>
		public Int32 OverallProgressStepSize
		{
			get
			{
				return m_intOverallProgressStepSize;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intOverallProgressStepSize != value)
					{
						booChanged = true;
						m_intOverallProgressStepSize = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => OverallProgressStepSize);
			}
		}

		#endregion

		#region Item Progress

		/// <summary>
		/// Gets whether the item progress is visible.
		/// </summary>
		/// <value>Whether the item progress is visible.</value>
		public bool ShowItemProgress
		{
			get
			{
				return m_booShowItemProgress;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_booShowItemProgress != value)
					{
						booChanged = true;
						m_booShowItemProgress = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => ShowItemProgress);
			}
		}

		/// <summary>
		/// Gets whether to display the item progress bar as a marquee.
		/// </summary>
		/// <value>Whether to display the item progress bar as a marquee.</value>
		public bool ShowItemProgressAsMarquee
		{
			get
			{
				return m_booShowItemProgressAsMarquee;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_booShowItemProgressAsMarquee != value)
					{
						booChanged = true;
						m_booShowItemProgressAsMarquee = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => ShowItemProgressAsMarquee);
			}
		}

		/// <summary>
		/// Gets the message shown above the item progress bar.
		/// </summary>
		/// <value>The message shown above the item progress bar.</value>
		public string ItemMessage
		{
			get
			{
				return m_strItemMessage;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (((m_strItemMessage == null) && (value != null)) ||
						((m_strItemMessage != null) && !m_strItemMessage.Equals(value)))
					{
						booChanged = true;
						m_strItemMessage = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => ItemMessage);
			}
		}

		/// <summary>
		/// Gets the progress on current item of work.
		/// </summary>
		/// <value>The progress on current item of work.</value>
		public Int64 ItemProgress
		{
			get
			{
				return m_intItemProgress;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intItemProgress != value)
					{
						booChanged = true;
						m_intItemProgress = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => ItemProgress);
			}
		}

		/// <summary>
		/// Gets the minimum value on the item progress bar.
		/// </summary>
		/// <value>The minimum value on the item progress bar.</value>
		public Int64 ItemProgressMinimum
		{
			get
			{
				return m_intItemProgressMinimum;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intItemProgressMinimum != value)
					{
						booChanged = true;
						m_intItemProgressMinimum = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => ItemProgressMinimum);
			}
		}

		/// <summary>
		/// Gets the maximum value on the item progress bar.
		/// </summary>
		/// <value>The maximum value on the item progress bar.</value>
		public Int64 ItemProgressMaximum
		{
			get
			{
				return m_intItemProgressMaximum;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intItemProgressMaximum != value)
					{
						booChanged = true;
						m_intItemProgressMaximum = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => ItemProgressMaximum);
			}
		}

		/// <summary>
		/// Gets the step size of the item progress bar.
		/// </summary>
		/// <value>The step size of the item progress bar.</value>
		public Int32 ItemProgressStepSize
		{
			get
			{
				return m_intItemProgressStepSize;
			}
			protected set
			{
				bool booChanged = false;
				lock (LOCK_OBJECT)
				{
					if (m_intItemProgressStepSize != value)
					{
						booChanged = true;
						m_intItemProgressStepSize = value;
					}
				}
				if (booChanged)
					OnPropertyChanged(() => ItemProgressStepSize);
			}
		}

		#endregion

		#endregion

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public BackgroundTask()
		{
		}

		#endregion

		#region Event Raising

		/// <summary>
		/// Raises the <see cref="TaskEnded"/> event.
		/// </summary>
		/// <param name="p_objReturnValue">The return value of the task.</param>
		protected void OnTaskEnded(object p_objReturnValue)
		{
			OnTaskEnded(null, p_objReturnValue);
		}

		/// <summary>
		/// Raises the <see cref="TaskEnded"/> event.
		/// </summary>
		/// <param name="p_strMessage">The task completion message.</param>
		/// <param name="p_objReturnValue">The return value of the task.</param>
		protected void OnTaskEnded(string p_strMessage, object p_objReturnValue)
		{
			OnTaskEnded(new TaskEndedEventArgs(Status, p_strMessage, p_objReturnValue));
		}

		/// <summary>
		/// Raises the <see cref="TaskEnded"/> event.
		/// </summary>
		/// <param name="e">A <see cref="TaskEndedEventArgs"/> describing the event arguments.</param>
		protected virtual void OnTaskEnded(TaskEndedEventArgs e)
		{
			ReturnValue = e.ReturnValue;
			TaskEnded(this, e);
		}

		/// <summary>
		/// Raises the <see cref="PropertyChanged"/> event.
		/// </summary>
		/// <typeparam name="T">The type of the property that changed.</typeparam>
		/// <param name="p_expProperty">An expression that is the property whose value changed.</param>
		protected void OnPropertyChanged<T>(Expression<Func<T>> p_expProperty)
		{
			OnPropertyChanged(new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(p_expProperty)));
		}

		/// <summary>
		/// Raises the <see cref="PropertyChanged"/> event.
		/// </summary>
		/// <param name="e">A <see cref="PropertyChangedEventArgs"/> describing the event arguments.</param>
		protected virtual void OnPropertyChanged(PropertyChangedEventArgs e)
		{
			PropertyChanged(this, e);
		}

		#endregion

		#region Task Control

		/// <summary>
		/// Cancels the background task.
		/// </summary>
		/// <remarks>
		/// This requests that the task end. It is up to the implementing task
		/// to periodically check <paramref name="Status"/>, and to end work
		/// as appropriate.
		/// </remarks>
		/// <seealso cref="Status"/>
		public virtual void Cancel()
		{
			Status = TaskStatus.Cancelling;
		}

		/// <summary>
		/// Pauses the task.
		/// </summary>
		/// <exception cref="InvalidOperationException">Thrown if the task does not support pausing.</exception>
		public virtual void Pause()
		{
			throw new InvalidOperationException("Task does not support pausing.");
		}

		/// <summary>
		/// Queues the task.
		/// </summary>
		/// <exception cref="InvalidOperationException">Thrown if the task does not support queuing.</exception>
		public virtual void Queue()
		{
			throw new InvalidOperationException("Task does not support queuing.");
		}

		/// <summary>
		/// Resumes the task.
		/// </summary>
		/// <exception cref="InvalidOperationException">Thrown if the task is not paused.</exception>
		public virtual void Resume()
		{
			throw new InvalidOperationException("Task is not paused.");
		}

		#endregion

		#region Progress Helpers

		/// <summary>
		/// Steps the overall progress.
		/// </summary>
		protected void StepOverallProgress()
		{
			OverallProgress += OverallProgressStepSize;
		}

		/// <summary>
		/// Steps the item progress.
		/// </summary>
		protected void StepItemProgress()
		{
			ItemProgress += ItemProgressStepSize;
		}

		#endregion
	}
}
