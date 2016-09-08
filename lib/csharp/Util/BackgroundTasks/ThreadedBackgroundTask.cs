using System;
using System.Diagnostics;
using System.Runtime.Remoting.Messaging;
using System.Threading;
using Util.Threading;

namespace Util.BackgroundTasks
{
	/// <summary>
	/// A base class for tasks that run in a background thread.
	/// </summary>
	/// <remarks>
	/// This class implements some base functionality, making writing backgounrd tasks
	/// simpler.
	/// 
	/// This class handles running the task in a thread. To implement the background
	/// task, you must provide a public method that calls one of the <c>Start</c>
	/// or <c>StartWait</c> methods. If threading management is not desired, use
	/// <see cref="BackgroundTask"/> instead.
	/// </remarks>
	public abstract class ThreadedBackgroundTask : BackgroundTask, IDisposable
	{
		private AutoResetEvent m_areTaskEnded = new AutoResetEvent(false);
		private object m_objReturnValue = null;

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public ThreadedBackgroundTask()
		{
		}

		#endregion

		#region Event Raising

		/// <summary>
		/// Raises the <see cref="IBackgroundTask.TaskEnded"/> event.
		/// </summary>
		/// <remarks>
		/// This signals the <see cref="StartWait(bool, object[])"/> method that the task has ended,
		/// and makes the return value accessible to said method.
		/// </remarks>
		/// <param name="e">A <see cref="TaskEndedEventArgs"/> describing the event arguments.</param>
		protected override void OnTaskEnded(TaskEndedEventArgs e)
		{
			m_areTaskEnded.Set();
			m_objReturnValue = e.ReturnValue;
			base.OnTaskEnded(e);
		}

		#endregion

		#region Task Control

		/// <summary>
		/// The method that is called to start the backgound task.
		/// </summary>
		/// <param name="p_objArgs">Arguments to for the task execution.</param>
		/// <param name="p_strMessage">The message describing the state of the task.</param>
		/// <returns>A return value.</returns>
		protected virtual object DoWork(object[] p_objArgs, out string p_strMessage)
		{
			p_strMessage = null;
			return DoWork(p_objArgs);
		}

		/// <summary>
		/// The method that is called to start the backgound task.
		/// </summary>
		/// <param name="p_objArgs">Arguments to for the task execution.</param>
		/// <returns>A return value.</returns>
		protected virtual object DoWork(object[] p_objArgs)
		{
			return null;
		}

		#region Task Start

		/// <summary>
		/// Starts the task in a foreground thread.
		/// </summary>
		/// <param name="p_objArgs">Arguments to pass to the task execution method.</param>
		/// <seealso cref="Start(bool, object[])"/>
		/// <seealso cref="StartWait(bool, object[])"/>
		/// <seealso cref="StartWait(object[])"/>
		protected void Start(params object[] p_objArgs)
		{
			Start(false, p_objArgs);
		}

		/// <summary>
		/// Starts the task, optionally in a background thread.
		/// </summary>
		/// <remarks>
		/// If the task is started in a background thread, the task will be terminated in the
		/// calling thread terminates. Otherwise, the calling thread will not terminate until
		/// the task completes.
		/// </remarks>
		/// <param name="p_booRunInBackground">Whether the task should be run in a background thread.</param>
		/// <param name="p_objArgs">Arguments to pass to the task execution method.</param>
		/// <seealso cref="Start(object[])"/>
		/// <seealso cref="StartWait(object[])"/>
		/// <seealso cref="StartWait(bool, object[])"/>
		protected void Start(bool p_booRunInBackground, params object[] p_objArgs)
		{
			//Not sure if BeginInvoke/EndInvoke or Thread is better for exception handling
			// it seem BeginInvoke/EndInvoke is not ideal. exceptions are trapped and rethrown
			// in EndThreadInvokeHandler when EnInvoke is called, so the debugger
			// breaks in EndThreadInvokeHandler, and not where the exception is actually thrown
			//however, I was using threads here, and I changed. according the the SVN log, I made
			// the switch to improve exception handling. not sure what issue I was encountering.
			// maybe the issue was actually related to the fact that some operations at the time
			// were wrapped in unneccessary threads - that issue has since been resolved
			//
			//I would like to find, and then document, a specific case where the thread
			// provides an advantage over BeginInvoke/EndInvoke. in StartWait(),
			// I seem to be observing the debugger break on the source of the exception, even
			// with BeginInvoke/EndInvoke, so I would like a conter-example.
			//example of BeginInvoke/EndInvoke breaking on exception source: if I insert:
			// if (System.Windows.Forms.MessageBox.Show("Now?", "CRASH", System.Windows.Forms.MessageBoxButtons.YesNo) == System.Windows.Forms.DialogResult.Yes)
			//		throw new DirectoryNotFoundException("DUMMY");
			// as the first line of Archive.public byte[] GetFileContents(string p_strPath)
			// StartWait() breaks on said line.

			/*Func<object, object> dlg = new Func<object, object>(RunThreadedWork);
			IAsyncResult ar = dlg.BeginInvoke(p_objArgs, EndThreadInvokeHandler, p_objArgs);*/

			TrackedThread thdWork = new TrackedThread(RunThread);
			thdWork.Thread.IsBackground = p_booRunInBackground;
			thdWork.Start(p_objArgs);
		}

		/// <summary>
		/// The callback use by the BeginInvoke method that runs the work in the background.
		/// </summary>
		/// <param name="p_asrResult">The result of the asynchronous operation.</param>
		private void EndThreadInvokeHandler(IAsyncResult p_asrResult)
		{
			((Func<object, object>)((AsyncResult)p_asrResult).AsyncDelegate).EndInvoke(p_asrResult);
			p_asrResult.AsyncWaitHandle.Close();
		}

		/// <summary>
		/// Starts the task in a foreground thread, and waits until the task completes.
		/// </summary>
		/// <param name="p_objArgs">Arguments to pass to the task execution method.</param>
		/// <returns>The return value of the task.</returns>
		/// <seealso cref="Start(object[])"/>
		/// <seealso cref="Start(bool, object[])"/>
		/// <seealso cref="StartWait(bool, object[])"/>
		protected object StartWait(params object[] p_objArgs)
		{
			return StartWait(false, p_objArgs);
		}

		/// <summary>
		/// Starts the task, optionally in a background thread, and waits until the task completes.
		/// </summary>
		/// <remarks>
		/// If the task is started in a background thread, the task will be terminated in the
		/// calling thread terminates. Otherwise, the calling thread will not terminate until
		/// the task completes.
		/// </remarks>
		/// <param name="p_booRunInBackground">Whether the task should be run in a background thread.</param>
		/// <param name="p_objArgs">Arguments to pass to the task execution method.</param>
		/// <returns>The return value of the task.</returns>
		/// <seealso cref="StartWait(object[])"/>
		/// <seealso cref="Start(object[])"/>
		/// <seealso cref="Start(bool, object[])"/>
		protected object StartWait(bool p_booRunInBackground, params object[] p_objArgs)
		{
			//see Start() for discussion on BeginInvoke/EndInvoke versus
			// threads
			//
			//in this method, it appears we should be using BeginInvoke/EndInvoke,
			// unlike in the Start() method. this is because it makes the most
			// sense for an exception thrown during the execution of the task to
			// bubble up the the caller of this method, which EndInvoke allows.
			// this is important for things like transactions: letting the exception
			// bubble up allows the transaction to roll back when an unhandled
			// exception is thrown in the task's code
			// with threading, this doesn't happen - at least not unless we make it.
			Func<object, object> dlg = new Func<object, object>(RunThreadedWork);
			IAsyncResult ar = dlg.BeginInvoke(p_objArgs, null, p_objArgs);
			m_objReturnValue = dlg.EndInvoke(ar);
			ar.AsyncWaitHandle.Close();

			/*
			m_areTaskEnded.Reset();
			Start(p_booRunInBackground, p_objArgs);
			m_areTaskEnded.WaitOne();*/
			return m_objReturnValue;
		}

		#endregion

		/// <summary>
		/// A wrapper to the work method called by the thread to start
		/// the work.
		/// </summary>
		/// <param name="p_objArgs">Arguments to pass to the task execution method.</param>
		private void RunThread(object p_objArgs)
		{
			RunThreadedWork(p_objArgs);
		}

		/// <summary>
		/// Runs the task by calling the <see cref="DoWork(object[])"/> method.
		/// </summary>
		/// <param name="p_objArgs">Arguments to pass to the task execution method.</param>
		/// <see cref="DoWork(object[])"/>
#if DEBUG
		[DebuggerStepThrough]
#endif
		private object RunThreadedWork(object p_objArgs)
		{
			object objReturnValue = null;
			string strMessage = null;
			try
			{
				objReturnValue = DoWork((object[])p_objArgs, out strMessage);
				switch (Status)
				{
					case TaskStatus.Cancelling:
						Status = TaskStatus.Cancelled;
						break;
					case TaskStatus.Paused:
					case TaskStatus.Running:
						Status = TaskStatus.Complete;
						break;
					case TaskStatus.Complete:
					case TaskStatus.Error:
					case TaskStatus.Incomplete:
					case TaskStatus.Cancelled:
						//do nothing - it seems status has already been set
						break;
					default:
						throw new Exception(String.Format("Unrecognized value for Status: {0}", Status));
				}
			}
			catch
			{
				//we have to catch and then rethrow all exceptions
				// so that any observers of this task, such as the
				// ProgressDialog, know that the task has ended.
				Status = TaskStatus.Error;
				OnTaskEnded(strMessage, objReturnValue);
				throw;
			}
			OnTaskEnded(strMessage, objReturnValue);
			return objReturnValue;
		}
		#endregion

		#region IDisposable Support
		private bool m_booDisposedValue = false;

		protected virtual void Dispose(bool disposing)
		{
			if (!m_booDisposedValue)
			{
				if (disposing)
				{
					m_areTaskEnded.Dispose();
				}

				m_booDisposedValue = true;
			}
		}

		public void Dispose()
		{
			Dispose(true);
		}
		#endregion
	}
}
