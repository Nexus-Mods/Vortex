using System;
using System.ComponentModel;

namespace Commands
{
	/// <summary>
	/// The base class for command bindings.
	/// </summary>
	public abstract class CommandBindingBase : ICommandBinding
	{
		private readonly object m_objTrigger;
		private readonly ICommand m_cmdCommand;

		#region Properties

		/// <summary>
		/// Gets the object that can trigger the command.
		/// </summary>
		/// <value>The object that can trigger the command.</value>
		public object Trigger
		{
			get
			{
				return m_objTrigger;
			}
		}

		/// <summary>
		/// Gets the command that can be triggered.
		/// </summary>
		/// <value>The command that can be triggered.</value>
		public ICommand Command
		{
			get
			{
				return m_cmdCommand;
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_objTrigger">The object that can trigger the command.</param>
		/// <param name="p_cmdCommand">The command that can be triggered.</param>
		protected CommandBindingBase(object p_objTrigger, ICommand p_cmdCommand)
		{
			if (p_objTrigger == null)
				throw new ArgumentNullException("p_objTrigger");
			if (p_cmdCommand == null)
				throw new ArgumentNullException("p_cmdCommand");
			m_objTrigger = p_objTrigger;
			m_cmdCommand = p_cmdCommand;
			m_cmdCommand.PropertyChanged += new PropertyChangedEventHandler(CommandPropertyChanged);
		}

		#endregion

		/// <summary>
		/// Executes the command.
		/// </summary>
		public abstract void Execute();

		/// <summary>
		/// Alters properties on the Trigger in response to property changes on the command.
		/// </summary>
		/// <param name="e">A <see cref="PropertyChangedEventArgs"/> describing the changed property.</param>
		protected virtual void OnCommandPropertyChanged(PropertyChangedEventArgs e)
		{
		}

		/// <summary>
		/// Handles the <see cref="INotifyPropertyChanged.PropertyChanged"/> event of the command.
		/// </summary>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">A <see cref="PropertyChangedEventArgs"/> describing the event arguments.</param>
		private void CommandPropertyChanged(object sender, PropertyChangedEventArgs e)
		{
			OnCommandPropertyChanged(e);
		}

		/// <summary>
		/// Disposes of the binding.
		/// </summary>
		/// <remarks>
		/// After this method is called, the binding between the trigger
		/// and command should no longer exist. In other words, activating the trigger should no
		/// longer execute the command.
		/// </remarks>
		public abstract void Unbind();
	}
}
