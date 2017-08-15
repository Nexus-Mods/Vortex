using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting
{
    /// <summary>
    /// A base class for script executors.
    /// </summary>
    /// <remarks>
    /// This class implements some base functionality, making writing executors
    /// simpler.
    /// </remarks>
    public abstract class ScriptExecutorBase : IScriptExecutor
    {
        #region Events

        /// <summary>
        /// Raised when a task in the set has started.
        /// </summary>
        /// <remarks>
        /// The argument passed with the event args is the task that
        /// has been started.
        /// </remarks>
        // ??? public event EventHandler<EventArgs<IBackgroundTask>> TaskStarted = delegate { };

        /// <summary>
        /// Raised when a task set has completed.
        /// </summary>
        // ??? public event EventHandler<TaskSetCompletedEventArgs> TaskSetCompleted = delegate { };

        #endregion

        private EventWaitHandle m_ewhSetCompleted = new EventWaitHandle(false, EventResetMode.ManualReset);

        #region Properties

        /// <summary>
        /// Gets whether the task set has completed.
        /// </summary>
        /// <value>Whether the task set has completed.</value>
        public bool IsCompleted { get; private set; }

        /// <summary>
        /// Gets whether the executor is queued.
        /// </summary>
        /// <value>Whether the executor is queued.</value>
        public bool IsQueued { get; set; }

        #endregion

        #region Event Raising

        /// <summary>
        /// Raises the <see cref="TaskStarted"/> event.
        /// </summary>
        /// <param name="e">An <see cref="EventArgs{IBackgroundTask}"/> describing the task that was started.</param>
        // ??? protected virtual void OnTaskStarted(EventArgs<IBackgroundTask> e)
        //{
        //	TaskStarted(this, e);
        //}

        /// <summary>
        /// Raises the <see cref="TaskStarted"/> event.
        /// </summary>
        /// <param name="p_bgtTask">The task that was started.</param>
        // ??? protected void OnTaskStarted(IBackgroundTask p_bgtTask)
        //{
        //	OnTaskStarted(new EventArgs<IBackgroundTask>(p_bgtTask));
        //}

        /// <summary>
        /// Raises the <see cref="TaskSetCompleted"/> event.
        /// </summary>
        /// <param name="e">A <see cref="TaskSetCompletedEventArgs"/> describing the task that was started.</param>
        // ??? protected virtual void OnTaskSetCompleted(TaskSetCompletedEventArgs e)
        //{
        //	IsCompleted = true;
        //	m_ewhSetCompleted.Set();
        //	TaskSetCompleted(this, e);
        //}

        /// <summary>
        /// Raises the <see cref="TaskSetCompleted"/> event.
        /// </summary>
        /// <param name="p_booSuccess">Whether or not the task set completed successfully.</param>
        /// <param name="p_strMessage">The message of the completed task set.</param>
        /// <param name="p_scpExecutedScript">The script that was executed.</param>
        // ??? protected void OnTaskSetCompleted(bool p_booSuccess, string p_strMessage, IScript p_scpExecutedScript)
        //{
        //	OnTaskSetCompleted(new TaskSetCompletedEventArgs(p_booSuccess, p_strMessage, p_scpExecutedScript));
        //}

        #endregion
        
        #region IScriptExecutor Members

        /// <summary>
        /// Executes the script.
        /// </summary>
        /// <returns><c>true</c> if the script completed
        /// successfully; <c>false</c> otherwise.</returns>
        public async Task<IList<Instruction>> Execute(IScript p_scpScript, string p_strDataPath)
        {
            
            // ??? OnTaskSetCompleted(booResult, "The script has finished executing.", p_scpScript);
            //return booResult;
            return await DoExecute(p_scpScript, p_strDataPath);
        }

        #endregion

        /// <summary>
        /// Performs the actual script execution.
        /// </summary>
        /// <remarks>
        /// This method is to be overridden by implementors to provide the actual
        /// execution logic.
        /// </remarks>
        /// <returns><c>true</c> if the script completed
        /// successfully; <c>false</c> otherwise.</returns>
        public abstract Task<IList<Instruction>> DoExecute(IScript p_scpScript, string p_strDataPath);

        /// <summary>
        /// Blocks until the task set is completed.
        /// </summary>
        public void Wait()
        {
            m_ewhSetCompleted.WaitOne();
        }
    }
}
