using System;
using System.Threading.Tasks;

namespace Utils
{
    public static class TaskHelper
    {
        /// <summary>
        /// run a task but throw a timeout exception if it doesn't complete in time
        /// </summary>
        /// <param name="task"></param>
        /// <param name="timeout"></param>
        /// <returns></returns>
        public static async Task<object> Timeout(Task<object> task, int timeout)
        {
            var res = await Task.WhenAny(task, Task.Delay(timeout));
            if (res == task)
            {
                return ((Task<object>)res).GetAwaiter().GetResult();
            }
            else
            {
                throw new TimeoutException("task timeout");
            }
        }
    }
}
