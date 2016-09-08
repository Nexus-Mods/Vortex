using System;
using System.Reflection;

namespace Commands.Generic
{
	/// <summary>
	/// A class that binds a command to an event.
	/// </summary>
	/// <typeparam name="T">The type of the command argument.</typeparam>
	public class EventCommandBinding<T> : CommandBinding<T>
	{
		private string m_strEventName = null;

		#region Properties

		/// <summary>
		/// Gets the event to which the command is bound.
		/// </summary>
		/// <value>The event to which the command is bound.</value>
		protected EventInfo Event
		{
			get
			{
				return Trigger.GetType().GetEvent(m_strEventName);
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that intializes the object with the given values.
		/// </summary>
		/// <param name="p_objTrigger">The object whose event will be bound to the command.</param>
		/// <param name="p_strEventName">The name of the event to bind to the command.</param>
		/// <param name="p_cmdCommand">The command to bind to the trigger.</param>
		/// <param name="p_dlgGetArgument">The method that returns the command argument.</param>
		public EventCommandBinding(object p_objTrigger, string p_strEventName, Command<T> p_cmdCommand, GetCommandArgument p_dlgGetArgument)
			: base(p_objTrigger, p_cmdCommand, p_dlgGetArgument)
		{
			m_strEventName = p_strEventName;
			EventInfo evtEvent = p_objTrigger.GetType().GetEvent(p_strEventName);
			if (evtEvent == null)
				throw new ArgumentException("Invalid event name (" + p_strEventName + ") for object of type " + p_objTrigger.GetType().FullName, "p_strEventName");
			evtEvent.AddEventHandler(p_objTrigger, new EventHandler(Event_Called));
		}

		#endregion

		/// <summary>
		/// Handles the event of the trigger object.
		/// </summary>
		/// <remarks>
		/// This executes the command.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">An <see cref="EventArgs"/> describing the event arguments.</param>
		private void Event_Called(object sender, EventArgs e)
		{
			if (Command.CanExecute)
				Execute();
		}

		/// <summary>
		/// Disposes of the binding.
		/// </summary>
		/// <remarks>
		/// After this method is called, the binding between the trigger
		/// and command should no longer exist. In other words, activating the trigger should no
		/// longer execute the command.
		/// </remarks>
		public override void Unbind()
		{
			Event.RemoveEventHandler(Trigger, new EventHandler(Event_Called));
		}
	}
}
