
$(document).ready(function(){
  $('body').css('width',window.innerWidth)
  window.onresize = function(event) {
    $('body').css('width',window.innerWidth)
  }

  $('.card-wrapper').click(function(){
    var key = $(this).attr('data-key')
  })

})
