export function track(
  action: string,
  label: string,
  duration: number = 0
): Promise<void> {
  return new Promise((resolve) => {
    //action will be tracked with analytics
    //https://cloud.google.com/appengine/docs/flexible/nodejs/integrating-with-analytics
  });
}
